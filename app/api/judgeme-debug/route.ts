import { NextResponse } from 'next/server';

/**
 * TEMPORARY diagnostic endpoint to figure out why individual reviews
 * aren't fetching even though aggregate badges (from Shopify metafields)
 * work fine. Bypasses ISR and the in-app helper so we see exactly what
 * Judge.me returns. Phase 243.
 *
 * DELETE THIS FILE after Judge.me individual-review fetch is confirmed
 * working. No PII leakage (we never expose the token), but it does
 * surface env-var presence + API response shape, which is more verbose
 * than we want in production long-term.
 *
 * Usage: GET /api/judgeme-debug?productId=<numeric_shopify_id>
 *   - returns the env-var state, the URL we called (token redacted),
 *     the HTTP status, and the first-100-chars of the response body.
 *
 * Path-bypass-safe — anyone with the protection-bypass cookie can hit
 * this. Should be deleted before public DNS cutover regardless.
 */
export const dynamic = 'force-dynamic';

const JUDGEME_BASE = 'https://judge.me/api/v1';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId') ?? '7894217031836';

  const token = process.env.JUDGEME_API_TOKEN;
  const shop = process.env.JUDGEME_SHOP_DOMAIN;

  const envState = {
    JUDGEME_API_TOKEN: token ? `set (len=${token.length}, first4=${token.slice(0, 4)}, last4=${token.slice(-4)})` : 'MISSING',
    JUDGEME_SHOP_DOMAIN: shop ?? 'MISSING',
  };

  if (!token || !shop) {
    return NextResponse.json({ env: envState, error: 'env_vars_missing' });
  }

  // Call 1: shop aggregate (widgets/index_information)
  const aggUrl = new URL(`${JUDGEME_BASE}/widgets/index_information`);
  aggUrl.searchParams.set('api_token', token);
  aggUrl.searchParams.set('shop_domain', shop);

  // Call 2: per-product reviews
  const revUrl = new URL(`${JUDGEME_BASE}/reviews`);
  revUrl.searchParams.set('api_token', token);
  revUrl.searchParams.set('shop_domain', shop);
  revUrl.searchParams.set('product_id', productId);
  revUrl.searchParams.set('per_page', '2');
  revUrl.searchParams.set('published', 'true');

  const [aggRes, revRes] = await Promise.all([
    fetch(aggUrl.toString(), { cache: 'no-store' }).catch((e) => ({ status: 0, ok: false, error: String(e) } as const)),
    fetch(revUrl.toString(), { cache: 'no-store' }).catch((e) => ({ status: 0, ok: false, error: String(e) } as const)),
  ]);

  const aggregate = await readResponse(aggRes);
  const reviews = await readResponse(revRes);

  // Redact token from URLs before echoing back.
  const redact = (u: string) => u.replace(token, '<REDACTED>');

  return NextResponse.json({
    env: envState,
    aggregate: {
      url: redact(aggUrl.toString()),
      status: 'status' in aggRes ? aggRes.status : 0,
      body: aggregate,
    },
    reviews: {
      url: redact(revUrl.toString()),
      productId,
      status: 'status' in revRes ? revRes.status : 0,
      body: reviews,
    },
  });
}

async function readResponse(res: { status: number; ok: boolean; error?: string } | Response): Promise<unknown> {
  if (!('text' in res)) return { networkError: res.error ?? 'unknown' };
  try {
    const text = await res.text();
    if (text.length === 0) return { empty: true };
    try {
      const json = JSON.parse(text);
      // Trim large arrays to first 2 items for readability.
      if (typeof json === 'object' && json !== null) {
        const summary: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(json)) {
          if (Array.isArray(v)) {
            summary[k] = { count: v.length, sample: v.slice(0, 2) };
          } else {
            summary[k] = v;
          }
        }
        return summary;
      }
      return json;
    } catch {
      return { rawPreview: text.slice(0, 500) };
    }
  } catch {
    return { readError: true };
  }
}
