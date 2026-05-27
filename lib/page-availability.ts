/**
 * Pure predicate for sale-page date-gate visibility. Extracted from
 * lib/inventory.ts so unit tests don't have to import the big
 * url-inventory JSON snapshots (which use `@/data/...` runtime path
 * aliases that don't resolve under Node's experimental-strip-types
 * loader).
 *
 * A page is "available now" when:
 *   - it's published in Shopify (isPublished === true), AND
 *   - either it has no availableAt metafield (always-on page), OR
 *   - the availableAt timestamp is now-or-earlier.
 *
 * Malformed availableAt strings (Date.parse → NaN) are permissive:
 * the page is treated as available. Better to render a sale page
 * with a corrupt metafield than to silently 404 it.
 *
 * `nowMs` is injectable so tests can pin time without
 * monkey-patching the Date global.
 */
export type AvailabilityCheckable = {
  isPublished: boolean;
  availableAt?: string | null;
};

export function isPageAvailable(p: AvailabilityCheckable, nowMs: number = Date.now()): boolean {
  if (!p.isPublished) return false;
  if (!p.availableAt) return true;
  const t = Date.parse(p.availableAt);
  return Number.isFinite(t) ? nowMs >= t : true;
}
