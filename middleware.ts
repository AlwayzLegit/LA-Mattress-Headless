import { NextResponse, type NextRequest } from 'next/server';
import { canonicalizeRouteParams } from './lib/route-canonicalization';
import { canonicalizeCollectionFilterPath } from './lib/collection-filter-redirect';
import { canonicalizeProductJsonPath } from './lib/json-suffix-redirect';
import { REDIRECTS } from './lib/redirects-table';

/**
 * Edge middleware — three responsibilities, evaluated in this order:
 *
 *   1. Apply legacy URL redirects from Shopify's urlRedirects table
 *      (sourced from `data/url-inventory/redirects.json`, codegen'd
 *      into `lib/redirects-table.ts`). Moved here from
 *      `next.config.mjs#redirects()` after the table grew past
 *      Vercel's 1024-redirect deploy cap. Middleware has no such cap.
 *   2. Canonicalize storefront URLs by stripping query-param noise
 *      (tracking IDs, malformed `?amp;...` from copy-pasted entity-
 *      encoded emails, empty filter values, etc.) via 301 redirect.
 *      See lib/route-canonicalization.ts for the allow-list.
 *   3. Protect /admin/* with HTTP Basic Auth + no-index headers.
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
 * Normalize a path the way the redirect-table lookup expects: strip
 * trailing slash on any path other than `/` itself. Keeps the lookup
 * idempotent across `/foo` and `/foo/`.
 */
function normPath(p: string): string {
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

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

  // (0) Host canonicalization: apex → www, permanent (308). The Semrush
  // 2026-07-03 pull showed 63 keywords (4.3% of organic traffic) ranking
  // under the apex host and ~30 paths indexed under BOTH hosts, splitting
  // link equity on money pages (audit seo-organic-03). Canonicals already
  // say www everywhere; this makes the response host agree. Belt-and-
  // suspenders with the Vercel domain-level redirect — if the platform
  // already 308s the apex, this branch simply never runs.
  const host = req.headers.get('host') ?? '';
  if (host === 'mattressstoreslosangeles.com') {
    // Absolute https target (not derived from req.nextUrl) so the
    // redirect is correct regardless of the incoming protocol/port —
    // the apex only exists in production, where www is always https.
    const target = new URL(
      `https://www.mattressstoreslosangeles.com${pathname}${req.nextUrl.search}${req.nextUrl.hash}`,
    );
    return NextResponse.redirect(target, 308);
  }

  // (1) Legacy URL redirects from Shopify's urlRedirects table.
  // O(1) lookup via Map. Skips /admin (auth-protected) and /_next /api
  // (no redirect logic needed for build assets or API routes).
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
    const dest = REDIRECTS.get(normPath(pathname));
    if (dest) {
      let location: string;
      if (/^https?:\/\//i.test(dest)) {
        // Absolute destination — use verbatim. Don't carry incoming
        // query/hash forward; the destination author chose what's
        // there.
        location = dest;
      } else {
        // Root-relative destination — merge with incoming origin and
        // carry forward query/hash so a request like
        // `/old?utm=x#section` redirects to `/new?utm=x#section`.
        const target = new URL(dest, req.nextUrl);
        if (req.nextUrl.search) target.search = req.nextUrl.search;
        if (req.nextUrl.hash) target.hash = req.nextUrl.hash;
        location = target.toString();
      }
      return NextResponse.redirect(location, 301);
    }
  }

  // (1.5) Legacy Shopify Liquid filter-subpath redirects. Inputs like
  // `/collections/mattresses/brand_stress-o-pedic` 404 in our headless
  // app (there is no `[handle]/[sub]` route), so 301 them to the parent
  // collection. See lib/collection-filter-redirect.ts for the pattern.
  // SEMrush 20260527 surfaced 3 of these as broken internal links;
  // representative article-body inspection shows ~10x that many in the
  // wild (size_*, type_*, Comfort_*, Brand_* variants). Runs AFTER the
  // legacy REDIRECTS table so a hand-curated redirect always wins.
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
    const parent = canonicalizeCollectionFilterPath(pathname);
    if (parent) {
      const target = new URL(parent, req.nextUrl);
      if (req.nextUrl.search) target.search = req.nextUrl.search;
      if (req.nextUrl.hash) target.hash = req.nextUrl.hash;
      return NextResponse.redirect(target, 301);
    }
  }

  // (1.6) Legacy Shopify `/products/<handle>.json` endpoint URLs. The
  // old Online Store theme served these natively; the headless app
  // 404s them. SEMrush 20260701 (orphan audit, issue 206) found stray
  // external references — 301 to the product page so residual link
  // equity flows. See lib/json-suffix-redirect.ts. Runs AFTER the
  // legacy REDIRECTS table so a hand-curated redirect always wins.
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
    const productPath = canonicalizeProductJsonPath(pathname);
    if (productPath) {
      const target = new URL(productPath, req.nextUrl);
      if (req.nextUrl.search) target.search = req.nextUrl.search;
      if (req.nextUrl.hash) target.hash = req.nextUrl.hash;
      return NextResponse.redirect(target, 301);
    }
  }

  // (2) Storefront param-stripping. Skip when there are no query params
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

  // (3) /admin/* requires Basic Auth — fall through to the auth logic.
  // Non-admin storefront paths with no query params just pass through.
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
 * Matcher — must cover every path that may need a legacy redirect.
 * Previously scoped to /admin + /products + /collections + /blogs +
 * /search, which missed /pages, /policies, root-level paths
 * (`/sale`, `/quiz`, etc.), and `/mattresses/*`.
 *
 * The negative-lookahead form below runs middleware on EVERY request
 * except static assets and Next internals. Cheap because middleware
 * itself short-circuits in <100µs when no redirect rule matches.
 *
 *   - /_next/* — Next.js build assets (chunks, images, etc.)
 *   - /api/*   — API routes (no redirects belong here)
 *   - /*.{ext} — static files served straight from /public
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|opengraph-image|icon\\.svg|manifest\\.webmanifest|assets/|api/).*)',
  ],
};
