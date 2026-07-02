/**
 * Legacy `.json`-suffix redirect logic for /products/<handle>.json.
 *
 * Background (SEMrush 20260701, "orphaned pages" issue 206): the audit
 * surfaced stray references to raw Shopify product JSON endpoints
 * (e.g. /products/standard-foundation-box-spring.json). The old Online
 * Store theme exposed these natively — Shopify serves a JSON
 * representation of any product at `<product-url>.json` — and old
 * theme JS, apps, and external scrapers picked the URLs up. The
 * headless storefront has no such endpoint, so they 404.
 *
 * Nothing on the current site links to them (verified against menus,
 * page bodies, metaobjects, and the rendered homepage), so this is
 * purely a belt-and-suspenders 301 for external crawl-discovery
 * surfaces (Google's index, legacy sitemaps, old backlinks): strip the
 * suffix and land on the product page so residual link equity flows.
 *
 * Deliberately scoped to /products/ — the only resource type the audit
 * found in the wild. A broader rule (collections, pages) can extend
 * the regex if a future crawl surfaces them.
 *
 * Pure function — no NextRequest dependency, fully unit-testable.
 */

/**
 * Matches `/products/<handle>.json` where handle is the Shopify handle
 * shape (alphanumerics + hyphens, case-insensitive to be permissive
 * about hand-typed URLs). The `.json` suffix must be terminal.
 *
 * Examples that match (caller redirects to /products/<handle>):
 *   /products/standard-foundation-box-spring.json
 *   /products/Some-Handle.json
 *
 * Examples that DON'T match:
 *   /products/foo                       (no suffix — normal route)
 *   /products/foo.json/extra            (suffix not terminal)
 *   /products/.json                     (empty handle)
 *   /collections/mattresses.json        (not a product path)
 */
const PRODUCT_JSON_SUFFIX = /^\/products\/([A-Za-z0-9-]+)\.json$/;

/**
 * If `pathname` is a legacy product `.json` endpoint URL, return the
 * product page path it should 301 to. Otherwise return null.
 *
 * Caller (middleware.ts) is responsible for preserving the incoming
 * query string and hash on the redirect.
 */
export function canonicalizeProductJsonPath(pathname: string): string | null {
  const m = pathname.match(PRODUCT_JSON_SUFFIX);
  if (!m) return null;
  return `/products/${m[1]}`;
}
