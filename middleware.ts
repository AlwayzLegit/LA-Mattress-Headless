import { NextResponse, type NextRequest } from 'next/server';
import { canonicalizeRouteParams } from './lib/route-canonicalization';

/**
 * Edge middleware — two responsibilities:
 *
 *   1. Protect /admin/* with HTTP Basic Auth + no-index headers.
 *   2. Canonicalize storefront URLs by stripping query-param noise
 *      (tracking IDs, malformed `?amp;...` from copy-pasted entity-
 *      encoded emails, empty filter values, etc.) via 301 redirect.
 *      See lib/route-canonicalization.ts for the allow-list.
 *
 * Why Basic Auth at the edge (instead of a custom login page):
 *   - Native browser prompt; no UI to build/maintain.
 *   - Credentials transmitted Base64 over HTTPS (encrypted by TLS).
 *   - Cached per-tab session, no logout-button needed.
 *   - Edge runtime → 401 returns in ~10ms with zero backend cost.
 *
 * Required env vars (set in Vercel → Project → Settings → Environment
 * Variables, all 3 environments):
 *   ADMIN_USER       — username (any string)
 *   ADMIN_PASSWORD   — password (high-entropy random string)
 *
 * Fail-safe default: when either env var is missing, /admin/* returns
 * 503 — better to lock the dashboard than to serve it unprotected.
 *
 * Defense-in-depth headers on every /admin/* response:
 *   X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
 *     Set at HTTP layer so bots that don't parse HTML (image/scrape
 *     crawlers, AI training scrapers) still see the directive.
 *
 * The /admin/* paths are ALSO disallowed in robots.txt (app/robots.ts)
 * so well-behaved crawlers never even attempt to fetch them.
 */

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/**
 * Constant-time string compare to avoid Basic-Auth timing oracles.
 * Falls back to plain compare when the lengths differ (in which case
 * no information leaks beyond "wrong length").
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function unauthorized(reason: string): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="admin", charset="UTF-8"',
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      'Cache-Control': 'no-store',
      // Debug-only — surfaced in dev tools, not visible to crawlers.
      'X-Auth-Reason': reason,
    },
  });
}

export function middleware(req: NextRequest): NextResponse {
  const pathname = req.nextUrl.pathname;

  // Storefront param-stripping. Skip when there are no query params
  // (fast path — most requests). When something needs cleaning, 301
  // to the canonical URL so crawlers never see the noisy variant.
  // Runs BEFORE the admin-auth branch because /admin/* is excluded
  // from the route-canonicalization allow-list anyway (returns
  // shouldRedirect=false). SEMrush 20260521_1 follow-up.
  if (!pathname.startsWith('/admin') && req.nextUrl.search) {
    const { shouldRedirect, cleanSearch } = canonicalizeRouteParams(
      pathname,
      req.nextUrl.searchParams,
    );
    if (shouldRedirect) {
      const target = new URL(pathname, req.nextUrl);
      const qs = cleanSearch.toString();
      if (qs) target.search = qs;
      return NextResponse.redirect(target, 301);
    }
    return NextResponse.next();
  }

  // /admin/* requires Basic Auth — fall through to the existing auth
  // logic. Non-admin storefront paths with no query params just
  // pass through (returned above).
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // If either env var isn't set, lock the dashboard rather than let it
  // through. Misconfiguration shouldn't accidentally expose data.
  if (!ADMIN_USER || !ADMIN_PASSWORD) {
    return new NextResponse('Admin authentication is not configured on this environment.', {
      status: 503,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        'Cache-Control': 'no-store',
      },
    });
  }

  const header = req.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('basic ')) {
    return unauthorized('no-basic');
  }

  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return unauthorized('bad-base64');
  }

  const sep = decoded.indexOf(':');
  if (sep < 0) return unauthorized('no-colon');
  const user = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);

  if (!timingSafeEqual(user, ADMIN_USER) || !timingSafeEqual(password, ADMIN_PASSWORD)) {
    return unauthorized('bad-credentials');
  }

  // Authenticated — pass through, but stamp the no-index header so
  // even shared screenshots / cached responses can't be indexed.
  const res = NextResponse.next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  res.headers.set('Cache-Control', 'no-store, private');
  return res;
}

/**
 * Two matcher groups:
 *   1. /admin/* — Basic Auth + no-index headers (this was the original
 *      scope; behaviour unchanged).
 *   2. The four storefront route trees where query-param noise was
 *      flagged by SEMrush 20260521_1 (orphan-page count). Static asset
 *      paths under /_next/ etc. are NOT matched, so middleware doesn't
 *      fire on every chunk or image.
 *
 * Adding /search to canonicalize `?q=` while stripping any junk
 * params alongside.
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/products/:path*',
    '/collections/:path*',
    '/blogs/:path*',
    '/search',
  ],
};
