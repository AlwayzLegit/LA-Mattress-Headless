/**
 * Filter-subpath redirect logic for /collections/<handle>/<filter>.
 *
 * Background (SEMrush 20260527): the audit flagged broken internal
 * links and 4xx errors on filter-style URLs under collection routes:
 *   - /collections/mattresses/brand_stress-o-pedic
 *   - /collections/englander-mattresses/Brand_Englander
 *   - /collections/bedroom-furniture/Brand_Bed-In-A-Box
 *
 * These follow the legacy Shopify Liquid theme convention
 * `/collections/<handle>/<TagPrefix>_<value>` for tag-faceted filtering.
 * Our headless storefront only routes `/collections/[handle]` —
 * anything below 404s. The fallouts in this audit are just the tip:
 * inspection of representative article bodies surfaced the same
 * pattern with `size_*`, `type_*`, `Comfort_*` prefixes (~10+
 * variants per article). Manually rewriting each in the article
 * body via the seo-article-cleanup script doesn't fix the external
 * crawl-discovery surface (Google's index, SEMrush, legacy sitemaps).
 *
 * Edge-redirect strategy: detect any path matching the filter
 * convention and 301 to the parent collection. Internal link equity
 * flows; SEMrush re-crawl sees a clean 301 → 200 chain; the article-
 * body cleanup script becomes belt-and-suspenders rather than the
 * sole defense.
 *
 * Pattern boundary: only match when the trailing segment has the
 * shape `<word><underscore><value>` so a future legitimate sub-route
 * (e.g. `/collections/<handle>/products` if we add one) doesn't get
 * eaten by this redirect.
 *
 * Pure function — no NextRequest dependency, fully unit-testable.
 */

/**
 * Matches `/collections/<handle>/<Prefix>_<value>` where:
 *   - handle: lowercase alphanumerics + hyphens (Shopify handle shape)
 *   - prefix: starts with a letter (any case), followed by alphanumerics + hyphens
 *   - underscore separator
 *   - value: alphanumerics + hyphens + dots + underscores
 *
 * Examples that match (caller redirects to /collections/<handle>):
 *   /collections/mattresses/brand_stress-o-pedic
 *   /collections/englander-mattresses/Brand_Englander
 *   /collections/bedroom-furniture/Brand_Bed-In-A-Box
 *   /collections/mattresses/size_queen
 *   /collections/mattresses/type_hybrid
 *   /collections/mattresses/Comfort_Pillowtop
 *
 * Examples that DON'T match:
 *   /collections/mattresses                    (no sub-segment)
 *   /collections/mattresses/products           (no underscore-value)
 *   /collections                               (no handle either)
 *   /collections/X/Y/Z                         (deeper than 1 segment)
 */
const COLLECTION_FILTER_SUBPATH = /^\/collections\/([a-z0-9-]+)\/[A-Za-z][A-Za-z0-9-]*_[A-Za-z0-9_.-]+$/;

/**
 * If `pathname` is a legacy collection filter URL, return the parent
 * collection path it should 301 to. Otherwise return null.
 *
 * Caller (middleware.ts) is responsible for preserving the incoming
 * query string and hash on the redirect.
 */
export function canonicalizeCollectionFilterPath(pathname: string): string | null {
  const m = pathname.match(COLLECTION_FILTER_SUBPATH);
  if (!m) return null;
  return `/collections/${m[1]}`;
}
