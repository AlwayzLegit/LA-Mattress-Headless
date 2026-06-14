/**
 * Pure URL canonicalization for storefront routes.
 *
 * Background (SEMrush 20260521_1): the audit flagged 189 pages as
 * "Pages with only one internal link". Sampling showed:
 *   - 56 of 56 /blogs/* URLs had query strings (variants of a single
 *     article via UTM / Shopify-proxy / malformed `?amp;` params)
 *   - 49 of 55 /collections/* URLs were query variants
 *   - 77 of 77 /products/* URLs were query variants
 *
 * Net: 183 of 189 "orphan pages" were just noise-param variants of
 * legitimate pages whose canonical was already correct. The fix is to
 * 301 them at the edge so the crawler only ever sees the canonical
 * URL — Semrush's orphan-counter then collapses by ~183.
 *
 * This module is a pure function: given a pathname + URLSearchParams,
 * return either:
 *   - `null` — URL is already canonical, no redirect needed
 *   - a `URLSearchParams` — the cleaned query string the caller should
 *     redirect to
 *
 * The middleware (middleware.ts) is the only consumer; it builds the
 * redirect URL from the result and emits a 301. Splitting the decision
 * here keeps the edge-runtime function tiny and the logic testable.
 *
 * Allow-list approach: only KNOWN-LEGITIMATE params survive. Anything
 * else gets stripped, regardless of whether we recognize it. This is
 * deliberate — the cost of accidentally dropping a future legitimate
 * param is a single audit cycle to notice and add to the allow-list;
 * the cost of letting noise through is what we've been paying for
 * months with the orphan-page count.
 */

type AllowSpec = {
  /** Exact-match param names that survive the strip. */
  exact: ReadonlySet<string>;
  /** Param-name prefixes that survive (e.g. `filter.` on collections). */
  prefixes?: ReadonlyArray<string>;
};

const ROUTE_ALLOW: ReadonlyArray<readonly [RegExp, AllowSpec]> = [
  // Homepage: no legitimate query surface at all. SEMrush 20260614
  // flagged ~17 homepage param-variants as orphan "one internal link"
  // pages — `/?amp;_fid=…&variant=…`, `/?_sid=…`, `/?variant=…`,
  // `/?preview_key=…` (leaked Shopify-theme preview; the headless
  // storefront previews via /api/preview, not a homepage query). The
  // homepage was NOT in this list, so these passed through uncanonical
  // and the page emitted a canonical to `/` — duplicate content instead
  // of consolidation. Empty allow-set ⇒ any param on `/` is stripped
  // and 301'd to the clean homepage.
  [/^\/$/, { exact: new Set<string>() }],

  // PDPs: the only legitimate query is `?variant=<id>` selecting a
  // size/color combo. Anything else (utm_*, _fid, _ss, _sid, _psq,
  // _v, amp, gclid, fbclid, srsltid, etc.) is tracking noise.
  [/^\/products(\/|$)/, { exact: new Set(['variant']) }],

  // PLPs: Shopify's filter UI emits `?filter.v.option.size=Queen`,
  // `?filter.v.price.gte=500`, `?sort_by=price-ascending`, `?page=2`.
  // All allowed. Empty filter values (`?filter.v.price.gte=`) get
  // stripped — they're the artifact of a cleared filter that the URL
  // forgot to drop.
  [/^\/collections(\/|$)/, {
    exact: new Set(['variant', 'sort_by', 'page']),
    prefixes: ['filter.'],
  }],

  // Blog index uses `?page` for pagination + the Shopify Storefront
  // GraphQL `after` cursor for deep-linked deep pages.
  [/^\/blogs(\/|$)/, { exact: new Set(['page', 'after']) }],

  // Search uses `?q=<query>`.
  [/^\/search(\/|$)/, { exact: new Set(['q']) }],
];

export type CanonicalizationResult = {
  /** True if the URL needs a 301 to its canonical form. */
  shouldRedirect: boolean;
  /** The cleaned query string (use this for the redirect URL). */
  cleanSearch: URLSearchParams;
};

/**
 * Apply the per-route allow-list to a (pathname, searchParams) pair.
 *
 * Returns shouldRedirect=true when:
 *   - One or more params are not on the route's allow-list, OR
 *   - One or more "allowed prefix" params have an empty value
 *     (e.g. `?filter.v.price.gte=` from a cleared filter input).
 *
 * Returns shouldRedirect=false when the URL is already canonical OR
 * the route isn't on the allow-list at all (defensive — unknown
 * routes pass through unchanged rather than being canonicalized
 * blindly).
 */
export function canonicalizeRouteParams(
  pathname: string,
  search: URLSearchParams,
): CanonicalizationResult {
  // Find matching route allow-spec. If none matches (e.g. /, /cart,
  // /sleep-quiz), pass through — those routes either have no query
  // surface or aren't part of this audit's orphan problem.
  const spec = ROUTE_ALLOW.find(([re]) => re.test(pathname))?.[1];
  if (!spec) {
    return { shouldRedirect: false, cleanSearch: search };
  }

  const clean = new URLSearchParams();
  let dropped = false;
  for (const [k, v] of search) {
    if (spec.exact.has(k)) {
      // Empty allowed-name params are noise too (e.g. `?variant=`).
      // Don't preserve them; they don't drive any UI either.
      if (v.length > 0) {
        clean.append(k, v);
      } else {
        dropped = true;
      }
    } else if (spec.prefixes?.some((p) => k.startsWith(p))) {
      // Allowed-prefix param — keep only when non-empty.
      if (v.length > 0) {
        clean.append(k, v);
      } else {
        dropped = true;
      }
    } else {
      // Unknown param — strip.
      dropped = true;
    }
  }

  return { shouldRedirect: dropped, cleanSearch: clean };
}
