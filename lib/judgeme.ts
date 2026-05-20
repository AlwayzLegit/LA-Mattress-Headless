/**
 * Judge.me Reviews API — server-side fetch helpers.
 *
 * Used for two surfaces only:
 *   - /pages/reviews — aggregate header + latest-reviews carousel
 *     across the entire store
 *   - homepage Reviews section (static-sections.tsx) — same data,
 *     subset of items
 *
 * Per-product review fetch was removed in Phase 247 because Judge.me's
 * REST API silently ignores every per-product filter on this token
 * tier (verified in Phases 245/246 diagnostic — all of `external_id`,
 * `product_external_id`, `product_id`, `handle` return identical
 * unfiltered results). Phase 247 pivoted PDP reviews to Judge.me's
 * official client-side widget instead. See `<JudgemeWidget>` in
 * app/_components.
 *
 * Phase 249: pruned `getProductReviews`, `createReview`, and the
 * `CreateReviewPayload` / `CreateReviewResult` types that those used.
 * `shopifyProductIdFromGid` stays — still used by the PDP reviews
 * section to wire the widget's `data-id`.
 *
 * Setup (unchanged):
 *   1. Log into Judge.me → Settings → Public API → reveal token.
 *   2. Set Vercel env vars (Production + Preview + Development):
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
 * Extract the numeric Shopify product ID from a Storefront API gid string
 * (e.g. `gid://shopify/Product/7894217031836` → `7894217031836`). Returns
 * null for malformed input so callers can short-circuit cleanly.
 *
 * Used by the PDP reviews section to derive the value for Judge.me's
 * widget `data-id` attribute (Phase 248).
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

// ───────────────────────────────────────────────────────────────────────
// Sitewide-reviews JSON-LD (Phase 299)
//
// Per-product Review embedding is impossible on the current Judge.me
// token tier (Phase 247: all per-product filters silently ignored).
// What still works: sitewide AggregateRating + the top-rated 4★+ reviews
// fetched without a filter. Embedded as `aggregateRating` + `review[]`
// on the homepage LocalBusiness (FurnitureStore) schema and on the
// /pages/reviews Organization schema, both linked via @id to the
// sitewide #localbusiness / #organization nodes.
//
// This makes the brand eligible for the LocalBusiness review-snippet
// rich result in SERP — the gold stars + count under the brand name on
// queries like "LA Mattress" or "mattress store Los Angeles". Not the
// same as the per-product reviews rich result (still gated on
// Judge.me's higher tier), but the largest review-rich-result win
// available without an upgrade.
// ───────────────────────────────────────────────────────────────────────

/** Truncate review body for embedding — Google ignores anything past
 *  the first few hundred chars and over-long reviews bloat the JSON-LD
 *  payload. Keeps full reviews visible in the rendered carousels. */
function truncateReview(body: string, max = 500): string {
  if (body.length <= max) return body;
  const slice = body.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > max * 0.7 ? slice.slice(0, lastSpace) : slice).trim() + '…';
}

/**
 * Format one Judge.me review as a Schema.org Review node. `itemReviewedId`
 * lets the caller pin the @id of the parent (LocalBusiness on homepage,
 * Organization on /pages/reviews) so each Review correctly attaches to
 * the brand entity instead of orphaning in the graph.
 */
function reviewLdFrom(r: JudgemeReview, itemReviewedId: string): Record<string, unknown> {
  return {
    '@type': 'Review',
    author: { '@type': 'Person', name: r.reviewer.name || 'Verified customer' },
    datePublished: r.created_at,
    reviewBody: truncateReview(r.body || ''),
    ...(r.title ? { name: r.title } : {}),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: r.rating,
      bestRating: 5,
      worstRating: 1,
    },
    itemReviewed: { '@id': itemReviewedId },
  };
}

/**
 * Async — fetches sitewide aggregate + top reviews and returns the
 * JSON-LD extension to merge onto a LocalBusiness / Organization node.
 * Returns `null` when Judge.me is unconfigured or returns no data,
 * letting callers fall through to the un-enriched base schema.
 *
 * `itemReviewedId` is the @id of the parent node the reviews attach to
 * (`https://.../#localbusiness` for homepage, `.../#organization` for
 * /pages/reviews). Both already exist in lib/structured-data.ts.
 *
 * 12 reviews is the sweet spot — Google's rich-result eligibility kicks
 * in at ≥1 review but more reviews tighten the relevance signal; past
 * ~15 there's diminishing return and the JSON-LD payload grows.
 */
export async function getSitewideReviewsExtension(
  itemReviewedId: string,
  { perPage = 12 }: { perPage?: number } = {},
): Promise<{ aggregateRating: Record<string, unknown>; review: Record<string, unknown>[] } | null> {
  if (!ENABLED) return null;
  const [aggregate, reviews] = await Promise.all([
    getShopAggregate(),
    getStorefrontReviews({ perPage, minRating: 4 }),
  ]);
  if (!aggregate || reviews.length === 0) return null;
  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: aggregate.rating.toFixed(1),
      reviewCount: aggregate.count,
      bestRating: '5',
      worstRating: '1',
    },
    review: reviews.map((r) => reviewLdFrom(r, itemReviewedId)),
  };
}
