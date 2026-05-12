import { NextResponse } from 'next/server';

/**
 * TEMPORARY diagnostic — Phase 246 final-attempt edition.
 * Tries every reasonable filter shape side-by-side so we can pick one.
 *
 * DELETE this file once individual reviews are confirmed flowing.
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

  const redact = (u: string) => u.replace(token, '<REDACTED>');

  const call = async (path: string, params: Record<string, string>) => {
    const u = new URL(`${JUDGEME_BASE}${path}`);
    u.searchParams.set('api_token', token);
    u.searchParams.set('shop_domain', shop);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    try {
      const res = await fetch(u.toString(), { cache: 'no-store' });
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = { rawPreview: text.slice(0, 200) };
      }
      return { url: redact(u.toString()), status: res.status, body };
    } catch (e) {
      return { url: redact(u.toString()), status: 0, error: String(e) };
    }
  };

  const summarize = (b: unknown): unknown => {
    if (typeof b !== 'object' || b === null) return b;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b)) {
      if (Array.isArray(v)) {
        out[k] = {
          length: v.length,
          first3External: v.slice(0, 3).map((r: any) => ({
            review_id: r?.id,
            product_external_id: r?.product_external_id,
            product_handle: r?.product_handle,
            product_title: r?.product_title?.slice(0, 60),
          })),
        };
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  // PRODUCT-LOOKUP VARIANTS — find the Judge.me internal product_id.
  const products_byExternalId = await call('/products', { external_id: productId, per_page: '5' });
  const products_byProductExternalId = await call('/products', { product_external_id: productId, per_page: '5' });
  const products_listOnly = await call('/products', { per_page: '5' });
  const products_byGid = await call('/products', { external_id: `gid://shopify/Product/${productId}`, per_page: '5' });

  // REVIEW-LOOKUP VARIANTS — try every plausible filter.
  const reviews_byExternalId = await call('/reviews', { external_id: productId, per_page: '3', published: 'true' });
  const reviews_byProductExternalId = await call('/reviews', { product_external_id: productId, per_page: '3', published: 'true' });
  const reviews_byGid = await call('/reviews', { external_id: `gid://shopify/Product/${productId}`, per_page: '3', published: 'true' });
  const reviews_byProductIdGid = await call('/reviews', { product_id: `gid://shopify/Product/${productId}`, per_page: '3', published: 'true' });
  const reviews_handleFilter = await call('/reviews', { handle: 'tempur-pedic-tempur-proadapt-medium-hybrid', per_page: '3', published: 'true' });
  // Larger page for client-side filtering test.
  const reviews_unfilteredLarge = await call('/reviews', { per_page: '100', published: 'true' });

  // Look up reviews where product_external_id MATCHES our target, from the large page.
  let clientSideMatches: unknown = null;
  if (typeof reviews_unfilteredLarge.body === 'object' && reviews_unfilteredLarge.body !== null) {
    const arr = (reviews_unfilteredLarge.body as { reviews?: unknown[] }).reviews;
    if (Array.isArray(arr)) {
      const wanted = String(productId);
      const matching = arr.filter((r: any) => String(r?.product_external_id) === wanted);
      clientSideMatches = {
        totalScanned: arr.length,
        matchedCount: matching.length,
        firstMatch: matching[0] ? {
          id: (matching[0] as any).id,
          product_external_id: (matching[0] as any).product_external_id,
          product_title: (matching[0] as any).product_title,
          rating: (matching[0] as any).rating,
          body: (matching[0] as any).body?.slice(0, 80),
        } : null,
        // Are reviews paginated? Check if we hit the per_page cap.
        likelyHasMore: arr.length === 100,
      };
    }
  }

  return NextResponse.json({
    env: envState,
    targetShopifyExternalId: productId,
    productLookupVariants: {
      byExternalId: { ...products_byExternalId, body: summarize(products_byExternalId.body) },
      byProductExternalId: { ...products_byProductExternalId, body: summarize(products_byProductExternalId.body) },
      byGid: { ...products_byGid, body: summarize(products_byGid.body) },
      listOnly: { ...products_listOnly, body: summarize(products_listOnly.body) },
    },
    reviewLookupVariants: {
      byExternalId: { ...reviews_byExternalId, body: summarize(reviews_byExternalId.body) },
      byProductExternalId: { ...reviews_byProductExternalId, body: summarize(reviews_byProductExternalId.body) },
      byGid: { ...reviews_byGid, body: summarize(reviews_byGid.body) },
      byProductIdGid: { ...reviews_byProductIdGid, body: summarize(reviews_byProductIdGid.body) },
      handleFilter: { ...reviews_handleFilter, body: summarize(reviews_handleFilter.body) },
    },
    clientSideFilterTest: {
      unfilteredCall: { url: reviews_unfilteredLarge.url, status: reviews_unfilteredLarge.status },
      matches: clientSideMatches,
    },
  });
}
