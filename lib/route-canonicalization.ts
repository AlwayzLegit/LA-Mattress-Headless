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

  // PLPs. Only the app's OWN param vocabulary is served as a live
  // (200 + noindex) faceted view: `?sort=PRICE-r`, `?vendor=Helix`,
  // `?size=Queen`, `?price=500-1500`, `?after=<cursor>` etc. — the
  // FILTER_PARAMS set in app/_components/plp-filters plus `sort` and
  // `after`. **These were MISSING from the original allow-list (PR
  // #447)**, which 301'd every sort/filter interaction back to the bare
  // URL so the grid silently never changed — the PLP filter UI was dead
  // in production from #447 until the Round 11 perf-isr-07 restructure
  // caught it. Locked down by tests; do not remove these.
  //
  // Legacy Shopify Liquid params (`variant`, `sort_by`, `page`, and the
  // `filter.*` family) are deliberately NOT allow-listed (Round 13,
  // SEMrush 2026-07-14 issues 209/213). The PLP client boundary
  // (PlpParamResults) reads only `sort`/`after` + FILTER_PARAMS, so a
  // legacy-param URL renders the IDENTICAL default grid — there is no
  // functional difference between serving it as a noindex'd 200 and
  // 301-ing it to the bare canonical URL, and the 301 is cleaner (no
  // wasted crawl budget, equity consolidates via the redirect). It also
  // fixes the semantically-nonsensical `?variant=` on collection pages
  // (variant selection is a PDP concept) and the malformed
  // `?variant=NNN?` double-`?` URLs the crawl surfaced. The app never
  // generates any of these; they come only from historical/external/
  // blog-content links, which the 301 handles gracefully.
  //
  // Empty allowed-param values (`?vendor=`) still get stripped — the
  // artifact of a cleared filter the URL forgot to drop.
  [/^\/collections(\/|$)/, {
    exact: new Set([
      'sort', 'after',
      'vendor', 'type', 'size', 'price', 'firmness', 'sleepPosition', 'heightRange',
    ]),
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
    // Next.js App Router appends `_rsc=<hash>` to every soft-navigation
    // payload fetch. It must NEVER trigger a redirect (the client fetch
    // would follow the 301 and the navigation silently loses its query
    // params — the root cause of the dead filter UI fixed in Round 11),
    // and it must be preserved so the RSC request stays cache-keyed.
    if (k === '_rsc') {
      clean.append(k, v);
      continue;
    }
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
