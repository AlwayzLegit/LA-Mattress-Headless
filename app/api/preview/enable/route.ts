/**
 * Sale-page preview enabler — flips Next.js's draftMode on for the
 * caller's browser when they POST the right token.
 *
 * Usage (merchant QA workflow):
 *   1. Visit POST /api/preview/enable with body {"token":"<token>",
 *      "redirect":"/pages/4th-of-july-mattress-sale-2026"}
 *      (or use the GET form below for quick clicks from a bookmark)
 *   2. The handler verifies the token (constant-time) against
 *      `SALE_PAGE_PREVIEW_TOKEN` env var, calls draftMode().enable(),
 *      and 302-redirects to the requested URL.
 *   3. Subsequent requests in the same browser carry the
 *      __prerender_bypass cookie and bypass the SalePage
 *      `available_at` date gate (see app/(storefront)/pages/[handle]/page.tsx).
 *
 * Cookie lifetime: until the previewer hits /api/preview/disable or
 * clears their browser cookies. The cookie is HttpOnly + SameSite=Lax
 * + Secure (set by Next.js) so it never leaks via JS or cross-site
 * navigation.
 *
 * GET is supported for the bookmark UX: a merchant pastes
 * `https://www.mattressstoreslosangeles.com/api/preview/enable?token=...&redirect=/pages/foo`
 * into their browser and gets bumped straight to the page. The token
 * is still in the URL momentarily, but only on this one redirect hop —
 * NOT on the actual sale-page URL the user lands on, which is the
 * security improvement over the prior `?preview=<token>` scheme.
 */
import { NextResponse } from 'next/server';
import { draftMode } from 'next/headers';
import { verifyPreviewToken } from '@/lib/preview-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAFE_REDIRECT = /^\/[a-zA-Z0-9/_-]*$/;

function resolveRedirect(raw: string | null): string {
  // Allow only same-origin paths so a malicious link can't bounce the
  // merchant to an attacker-controlled host after acquiring preview.
  if (!raw) return '/';
  return SAFE_REDIRECT.test(raw) ? raw : '/';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const redirect = resolveRedirect(url.searchParams.get('redirect'));
  if (!verifyPreviewToken(token)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 401 });
  }
  const dm = await draftMode();
  dm.enable();
  return NextResponse.redirect(new URL(redirect, url));
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let body: { token?: string; redirect?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Allow empty body; rely on query params.
  }
  const token = body.token ?? url.searchParams.get('token');
  const redirect = resolveRedirect(body.redirect ?? url.searchParams.get('redirect'));
  if (!verifyPreviewToken(token ?? null)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 401 });
  }
  const dm = await draftMode();
  dm.enable();
  return NextResponse.redirect(new URL(redirect, url), { status: 303 });
}
