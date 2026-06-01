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
  // Judge.me's public API has shipped the reviewer name in different
  // shapes across shops / token tiers: sometimes `reviewer.name`,
  // sometimes split `first_name` / `last_name`, occasionally a
  // top-level `reviewer_name`. Type all optional and resolve with
  // `reviewerName()` so a populated-but-differently-keyed name never
  // falls through to "Anonymous".
  reviewer: { name?: string | null; first_name?: string | null; last_name?: string | null } | null;
  reviewer_name?: string | null;
  product_external_id: number | null;
  created_at: string;
  verified: boolean | null;
  pictures?: { urls: { compact?: string; small?: string; original?: string } }[];
};

/**
 * Resolve a display name from a Judge.me review across the field shapes
 * their public API uses. Returns the fallback only when every known
 * field is empty.
 */
export function reviewerName(r: JudgemeReview, fallback = 'Verified customer'): string {
  const rv = r.reviewer ?? {};
  const direct = (rv.name ?? '').trim();
  if (direct) return direct;
  const joined = [rv.first_name, rv.last_name]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (joined) return joined;
  const top = (r.reviewer_name ?? '').trim();
  if (top) return top;
  return fallback;
}

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
 * Tokenize a review body for similarity comparison. Lowercases, strips
 * punctuation, splits on whitespace, drops short tokens (<=2 chars) and
 * common stopwords. The remaining set captures the substantive content
 * words used in Jaccard similarity.
 */
const REVIEW_STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'this', 'that', 'with', 'have',
  'has', 'had', 'but', 'not', 'you', 'your', 'our', 'their', 'they',
  'will', 'all', 'any', 'were', 'been', 'being', 'from', 'just', 'very',
  'too', 'one', 'two', 'about', 'when', 'what', 'who', 'how', 'can',
  'get', 'got', 'into', 'out', 'over', 'after', 'before', 'than',
  'then', 'them', 'these', 'those', 'such', 'some', 'much', 'more',
]);
function reviewTokens(body: string): Set<string> {
  return new Set(
    body
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !REVIEW_STOPWORDS.has(t)),
  );
}

/**
 * Filter near-duplicate reviews so the rendered carousel feels varied
 * rather than 6 different sleepers all writing "Great service, will
 * buy again". For each candidate review we check it against the
 * already-accepted set:
 *   - exact body match → drop
 *   - title match (case-insensitive) when both have titles → drop
 *   - Jaccard similarity over content tokens > 0.55 → drop
 *
 * Sorts by body length descending first so when a cluster of near-
 * duplicates exists we keep the most substantive version. Returns
 * the kept reviews re-sorted by created_at desc to preserve recency
 * for the caller.
 */
export function dedupeReviews(reviews: JudgemeReview[]): JudgemeReview[] {
  const seen: { tokens: Set<string>; body: string; title: string }[] = [];
  const kept: JudgemeReview[] = [];
  const sorted = [...reviews].sort((a, b) => (b.body?.length ?? 0) - (a.body?.length ?? 0));
  for (const r of sorted) {
    const body = (r.body || '').toLowerCase().trim();
    if (!body) continue;
    const title = (r.title || '').toLowerCase().trim();
    const tokens = reviewTokens(body);
    let duplicate = false;
    for (const s of seen) {
      if (s.body === body) { duplicate = true; break; }
      if (title && s.title && title === s.title) { duplicate = true; break; }
      if (tokens.size >= 3 && s.tokens.size >= 3) {
        let intersection = 0;
        for (const t of tokens) if (s.tokens.has(t)) intersection++;
        const union = tokens.size + s.tokens.size - intersection;
        if (union > 0 && intersection / union > 0.55) { duplicate = true; break; }
      }
    }
    if (!duplicate) {
      seen.push({ tokens, body, title });
      kept.push(r);
    }
  }
  return kept.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * True when a review carries a real, displayable reviewer name — i.e. not
 * empty and not the literal placeholder "Anonymous" that Judge.me stores
 * for reviews submitted/imported without a name. Used to prefer named
 * reviews in the storefront carousels so the social-proof sections lead
 * with attributable voices rather than a wall of "Anonymous".
 */
export function hasRealReviewerName(r: JudgemeReview): boolean {
  const n = reviewerName(r, '').trim().toLowerCase();
  return n !== '' && n !== 'anonymous';
}

/**
 * Latest top-rated reviews across all products. Used on /pages/reviews and
 * on the homepage Reviews section. Cached for 1 hour.
 *
 * Over-fetches from Judge.me and applies dedupeReviews() so the rendered
 * carousels never show 6 different sleepers writing the same short
 * "Great service" sentiment — varied bodies make the social-proof section
 * actually persuasive. Pass `dedupe: false` for raw output (rare; only
 * needed when downstream needs the unfiltered set).
 *
 * `preferNamed` (default true): a large share of this store's published
 * reviews carry the literal reviewer name "Anonymous" in Judge.me. To stop
 * the carousels filling entirely with "Anonymous", we partition the fetched
 * pool into named vs. anonymous, dedupe each independently, and lead with
 * the named ones — falling back to anonymous reviews only to top up to
 * `perPage`. Deduping the named set on its own also stops a named review
 * being dropped as a near-duplicate of a longer *anonymous* one (which is
 * how named voices were being lost before).
 */
export async function getStorefrontReviews({
  perPage = 12,
  page = 1,
  minRating = 4,
  dedupe = true,
  preferNamed = true,
}: { perPage?: number; page?: number; minRating?: number; dedupe?: boolean; preferNamed?: boolean } = {}): Promise<JudgemeReview[]> {
  if (!ENABLED) return [];
  try {
    // Over-fetch widely when deduping or preferring named reviews so there's
    // a deep enough pool to find attributable voices; Judge.me caps at 100.
    const fetchSize = dedupe || preferNamed ? 100 : perPage;
    const res = await fetch(
      // NOTE: do NOT pass `rating` to /reviews — Judge.me treats it as an
      // EXACT match, not a minimum (see getShopAggregate below, which fires
      // one /reviews/count per rating 1-5 precisely for that reason). Passing
      // `rating=4` returned *only* 4-star reviews, which for this store are
      // almost all the literal name "Anonymous", while the 5-star reviews
      // (which carry real reviewer names) were excluded entirely — the actual
      // cause of #11's wall of "Anonymous". Fetch unfiltered and apply the
      // `>= minRating` floor client-side below.
      buildUrl('/reviews', { per_page: fetchSize, page, published: 'true' }),
      // Tag versioned (v4) to force a cache miss: the request URL changed
      // (dropped `rating`) so it's a new key anyway, but bumping the tag keeps
      // the intent explicit. Vercel's data cache is shared across deployments.
      { next: { revalidate: 3600, tags: ['judgeme:reviews-v4'] } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as ReviewsResponse;
    const raw = (data.reviews ?? []).filter((r) => (r.rating ?? 0) >= minRating);
    const process = (list: JudgemeReview[]) => (dedupe ? dedupeReviews(list) : list);
    if (!preferNamed) return process(raw).slice(0, perPage);
    // Named first (deduped on their own so they aren't lost to anonymous
    // near-duplicates), then anonymous reviews only to top up the count.
    // Also collapse to one review per distinct reviewer so the same name
    // doesn't repeat back-to-back when someone left several reviews.
    const seenNames = new Set<string>();
    const named = process(raw.filter(hasRealReviewerName)).filter((r) => {
      const key = reviewerName(r).toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
    if (named.length >= perPage) return named.slice(0, perPage);
    const anon = process(raw.filter((r) => !hasRealReviewerName(r)));
    return [...named, ...anon].slice(0, perPage);
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
 * header and the AggregateRating JSON-LD on collection / generic CMS
 * pages (lib/collection-jsonld.ts + lib/page-jsonld.ts, both wired in
 * via mainEntity → Organization in #316).
 *
 * Implementation note (20260528): the original /widgets/index_information
 * endpoint Judge.me used to return a pre-aggregated
 * `{ average_rating, reviews_count }` payload was migrated away from
 * their public REST surface — every collection / PDP / /pages/reviews
 * was rendering without aggregateRating because that endpoint started
 * returning their generic "Oops, page not found" HTML. PRs #324 / #326
 * / #328 progressively narrowed down the new working surface:
 *
 *   - /api/v1/reviews/count       → JSON { count: N } (200 OK)
 *   - /api/v1/reviews?rating=X    → JSON list filtered by rating
 *
 * Both accept query-string auth (`?api_token=X&shop_domain=Y`).
 *
 * Strategy: fire 5 parallel /reviews/count calls (one per rating 1-5)
 * and compute the exact weighted average. 5 small JSON responses,
 * cached at the fetch layer for 1h, ~50-150ms total wall time
 * dominated by the slowest tail.
 *
 * Returns null when:
 *   - env vars are unset (ENABLED gate)
 *   - any /reviews/count call returns non-2xx
 *   - the total count is zero (no reviews → no AggregateRating)
 *   - the computed avg falls outside [1, 5] (sanity guard so we
 *     don't emit invalid AggregateRating to Google)
 */
export async function getShopAggregate(): Promise<ShopReviewsAggregate | null> {
  if (!ENABLED) return null;
  try {
    const ratings = [1, 2, 3, 4, 5] as const;
    const counts = await Promise.all(
      ratings.map((rating) =>
        fetch(buildUrl('/reviews/count', { rating }), {
          next: { revalidate: 3600, tags: ['judgeme:aggregate-v2'] },
        }).then(async (res) => {
          if (!res.ok) return null;
          const data = (await res.json().catch(() => null)) as { count?: number } | null;
          return typeof data?.count === 'number' ? data.count : null;
        }).catch(() => null),
      ),
    );
    if (counts.some((c) => c === null)) return null;
    const safeCounts = counts as number[];
    const total = safeCounts.reduce((s, c) => s + c, 0);
    if (total <= 0) return null;
    const weighted = ratings.reduce((s, r, i) => s + r * safeCounts[i], 0);
    const avg = weighted / total;
    if (!Number.isFinite(avg) || avg < 1 || avg > 5) return null;
    return { rating: avg, count: total };
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
    author: { '@type': 'Person', name: reviewerName(r) },
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
