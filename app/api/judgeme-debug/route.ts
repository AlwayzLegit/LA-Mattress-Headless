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

  // Step 1: resolve Judge.me's internal product_id from Shopify external_id
  const prodUrl = new URL(`${JUDGEME_BASE}/products/-1`);
  prodUrl.searchParams.set('api_token', token);
  prodUrl.searchParams.set('shop_domain', shop);
  prodUrl.searchParams.set('external_id', productId);
  const prodRes = await fetch(prodUrl.toString(), { cache: 'no-store' }).catch(
    (e) => ({ status: 0, ok: false, error: String(e) } as const),
  );
  const prodBody = await readResponse(prodRes);

  // Try to pull the JM internal id out of the product response.
  let jmProductId: number | null = null;
  if (prodBody && typeof prodBody === 'object' && 'product' in prodBody) {
    const p = (prodBody as { product?: { id?: number } }).product;
    if (p && typeof p.id === 'number') jmProductId = p.id;
  }

  // Also try the products list endpoint as a fallback (some Judge.me API
  // versions expose only the list form, not the singleton GET).
  let listBody: unknown = null;
  let listStatus = 0;
  if (jmProductId === null) {
    const listUrl = new URL(`${JUDGEME_BASE}/products`);
    listUrl.searchParams.set('api_token', token);
    listUrl.searchParams.set('shop_domain', shop);
    listUrl.searchParams.set('external_id', productId);
    listUrl.searchParams.set('per_page', '1');
    const listRes = await fetch(listUrl.toString(), { cache: 'no-store' }).catch(
      (e) => ({ status: 0, ok: false, error: String(e) } as const),
    );
    listBody = await readResponse(listRes);
    listStatus = 'status' in listRes ? listRes.status : 0;
    if (listBody && typeof listBody === 'object' && 'products' in listBody) {
      const arr = (listBody as { products?: { sample?: { id?: number }[] } }).products;
      if (arr?.sample?.[0]?.id) jmProductId = arr.sample[0].id;
    }
  }

  // Step 2: fetch reviews with whichever IDs we have. Try both shapes
  // side-by-side so we can see which one actually filters.
  const tryReviews = async (params: Record<string, string>) => {
    const u = new URL(`${JUDGEME_BASE}/reviews`);
    u.searchParams.set('api_token', token);
    u.searchParams.set('shop_domain', shop);
    u.searchParams.set('per_page', '3');
    u.searchParams.set('published', 'true');
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const res = await fetch(u.toString(), { cache: 'no-store' }).catch(
      (e) => ({ status: 0, ok: false, error: String(e) } as const),
    );
    return {
      url: u.toString().replace(token, '<REDACTED>'),
      status: 'status' in res ? res.status : 0,
      body: await readResponse(res),
    };
  };

  const variants: Record<string, Awaited<ReturnType<typeof tryReviews>>> = {};
  variants.by_external_id = await tryReviews({ external_id: productId });
  if (jmProductId !== null) {
    variants.by_internal_product_id = await tryReviews({ product_id: String(jmProductId) });
  }
  variants.by_product_external_id = await tryReviews({ product_external_id: productId });

  return NextResponse.json({
    env: envState,
    productLookup: {
      shopifyExternalId: productId,
      judgemeInternalId: jmProductId,
      singletonGet: {
        url: prodUrl.toString().replace(token, '<REDACTED>'),
        status: 'status' in prodRes ? prodRes.status : 0,
        body: prodBody,
      },
      listFallback: jmProductId === null ? {
        status: listStatus,
        body: listBody,
      } : null,
    },
    reviewVariants: variants,
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
