/**
 * Judge.me Reviews API — server-side fetch helpers.
 *
 * We pull individual review records (not just the aggregate metafields,
 * which we already render on PDPs via the ProductReviews type). Server-side
 * fetch keeps the public API token off the client, lets Next.js cache the
 * response per ISR config, and gives us SSR'd markup that's good for SEO.
 *
 * Setup:
 *   1. Log into Judge.me → Settings → Public API → reveal token.
 *   2. Set Vercel env vars (Production + Preview):
 *        JUDGEME_API_TOKEN=<that token>
 *        JUDGEME_SHOP_DOMAIN=<your-shop>.myshopify.com
 *   3. Redeploy.
 *
 * Until the env vars are set, every helper here returns `null` or `[]`,
 * so the storefront renders as if reviews aren't installed (graceful no-op).
 */

const JUDGEME_BASE = 'https://judge.me/api/v1';
const ENABLED = Boolean(process.env.JUDGEME_API_TOKEN && process.env.JUDGEME_SHOP_DOMAIN);

export type JudgemeReview = {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  reviewer: { name: string };
  product_external_id: number | null;
  created_at: string;
  verified: boolean | null;
  pictures?: { urls: { compact?: string; small?: string; original?: string } }[];
};

type ReviewsResponse = {
  current_page: number;
  per_page: number;
  reviews: JudgemeReview[];
};

type ShopReviewsAggregate = {
  rating: number;
  count: number;
};

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(`${JUDGEME_BASE}${path}`);
  url.searchParams.set('api_token', process.env.JUDGEME_API_TOKEN ?? '');
  url.searchParams.set('shop_domain', process.env.JUDGEME_SHOP_DOMAIN ?? '');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/**
 * Latest top-rated reviews across all products. Used on /pages/reviews and
 * on the homepage Reviews section. Cached for 1 hour.
 */
export async function getStorefrontReviews({ perPage = 12, page = 1, minRating = 4 } = {}): Promise<JudgemeReview[]> {
  if (!ENABLED) return [];
  try {
    const res = await fetch(
      buildUrl('/reviews', { per_page: perPage, page, rating: minRating, published: 'true' }),
      { next: { revalidate: 3600, tags: ['judgeme:reviews'] } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as ReviewsResponse;
    return data.reviews ?? [];
  } catch {
    return [];
  }
}

/**
 * Per-product reviews — feeds the PDP reviews section. Judge.me identifies
 * products by their Shopify numeric ID (not the storefront handle), so
 * pass the value extracted from `product.id` (e.g. `7894217031836` from
 * the full gid). Phase 238.
 */
export async function getProductReviews(
  productExternalId: string | number,
  { perPage = 8, page = 1 } = {},
): Promise<JudgemeReview[]> {
  if (!ENABLED) return [];
  try {
    const res = await fetch(
      buildUrl('/reviews', {
        product_id: productExternalId,
        per_page: perPage,
        page,
        published: 'true',
      }),
      { next: { revalidate: 3600, tags: ['judgeme:reviews', `judgeme:product:${productExternalId}`] } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as ReviewsResponse;
    return data.reviews ?? [];
  } catch {
    return [];
  }
}

/**
 * Submit a new review on behalf of a shopper. Used by /api/reviews
 * (the internal POST endpoint that proxies the form submission to
 * Judge.me) so the API token stays server-side. Reviews land in
 * Judge.me's moderation queue by default; the merchant approves them
 * in Judge.me Admin before they go live on the site. Phase 238.
 */
export type CreateReviewPayload = {
  productExternalId: string | number;
  rating: number;
  body: string;
  title?: string;
  name: string;
  email: string;
  /** Optional reviewer IP for Judge.me's fraud signals. Pass through from the request. */
  ipAddr?: string;
};

export type CreateReviewResult =
  | { ok: true; reviewId?: number }
  | { ok: false; error: string };

export async function createReview(payload: CreateReviewPayload): Promise<CreateReviewResult> {
  if (!ENABLED) return { ok: false, error: 'judgeme_not_configured' };
  try {
    const form = new URLSearchParams();
    form.set('api_token', process.env.JUDGEME_API_TOKEN ?? '');
    form.set('shop_domain', process.env.JUDGEME_SHOP_DOMAIN ?? '');
    form.set('platform', 'shopify');
    form.set('id', String(payload.productExternalId));
    form.set('name', payload.name);
    form.set('email', payload.email);
    form.set('rating', String(Math.max(1, Math.min(5, Math.round(payload.rating)))));
    form.set('body', payload.body);
    if (payload.title) form.set('title', payload.title);
    if (payload.ipAddr) form.set('ip_addr', payload.ipAddr);
    const res = await fetch(`${JUDGEME_BASE}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) return { ok: false, error: `judgeme_api_${res.status}` };
    const data = (await res.json()) as { review?: { id?: number } };
    return { ok: true, reviewId: data.review?.id };
  } catch {
    return { ok: false, error: 'judgeme_api_failed' };
  }
}

/**
 * Extract the numeric Shopify product ID from a Storefront API gid string
 * (e.g. `gid://shopify/Product/7894217031836` → `7894217031836`). Returns
 * null for malformed input so callers can short-circuit cleanly.
 */
export function shopifyProductIdFromGid(gid: string): string | null {
  const m = /\/Product\/(\d+)/.exec(gid);
  return m ? m[1] : null;
}

/**
 * Sitewide aggregate (avg rating + total count) for the /pages/reviews
 * header and for sitewide review-aggregate JSON-LD if we ever want it.
 */
export async function getShopAggregate(): Promise<ShopReviewsAggregate | null> {
  if (!ENABLED) return null;
  try {
    const res = await fetch(buildUrl('/widgets/index_information'), {
      next: { revalidate: 3600, tags: ['judgeme:aggregate'] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { average_rating?: number; reviews_count?: number };
    if (typeof data.average_rating !== 'number' || typeof data.reviews_count !== 'number') {
      return null;
    }
    return { rating: data.average_rating, count: data.reviews_count };
  } catch {
    return null;
  }
}
