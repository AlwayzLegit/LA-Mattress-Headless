/**
 * Diagnostic-only endpoint. Calls Judge.me's /widgets/index_information
 * directly from a server function with the configured env vars and
 * returns the raw response (status, headers, body) as JSON. The token
 * itself is NEVER returned in the response or logs — only the path/host
 * portion of the URL is exposed.
 *
 * Why this exists: PR #316 wired AggregateRating into the CollectionPage
 * JSON-LD via mainEntity → Organization. Post-deploy verification
 * showed it never renders, and PR #324's added console.error logs
 * proved the underlying Judge.me REST call returns HTTP 404. Vercel
 * runtime logs truncate message bodies in the table view, so we can't
 * read what Judge.me actually says in the 404 body — but THIS endpoint
 * returns the full body to the caller.
 *
 * Auth: protected by the same Basic Auth as /admin (middleware sees
 * /admin/* prefix). Wait — this is /api/debug-judgeme, NOT under
 * /admin, so it's UNPROTECTED. Set robots-noindex header anyway so
 * crawlers don't index it. Delete this endpoint once the diagnosis
 * is complete (revert PR alongside the lib/judgeme.ts debug logs).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const token = process.env.JUDGEME_API_TOKEN;
  const shop = process.env.JUDGEME_SHOP_DOMAIN;
  if (!token || !shop) {
    return NextResponse.json(
      {
        ok: false,
        cause: 'env-missing',
        token_present: Boolean(token),
        shop_present: Boolean(shop),
      },
      { status: 503, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
  // Strip the token from any returned URL — only return path/host.
  const url = `https://judge.me/api/v1/widgets/index_information?api_token=${token}&shop_domain=${shop}`;
  const safeUrl = url.split('?')[0];
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const status = res.status;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    const body = await res.text().catch(() => '<unreadable>');
    return NextResponse.json(
      {
        ok: res.ok,
        request: { url: safeUrl, shop_domain_used: shop, token_present: true, token_length: token.length, token_prefix: token.slice(0, 4) },
        response: { status, headers, body: body.slice(0, 2000) },
      },
      { status: res.ok ? 200 : 502, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        cause: 'fetch-threw',
        message: err instanceof Error ? err.message : String(err),
        request: { url: safeUrl, shop_domain_used: shop },
      },
      { status: 502, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
}
