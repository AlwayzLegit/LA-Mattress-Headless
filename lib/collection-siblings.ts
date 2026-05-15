/**
 * Phase 284 / SEO plan Phase 7 — cross-cut collection sub-nav.
 *
 * The catalog is sliced three independent ways in Shopify collections:
 *
 *   - brand   (tempur-pedic-mattresses, stearns-foster-mattresses, …)
 *   - size    (queen-size-mattresses, king-size-mattresses, …)
 *   - type    (memory-foam-mattresses, hybrid-mattresses, …)
 *
 * High-commercial-intent queries sit at the *intersection* of these
 * ("tempur-pedic queen mattress", "memory foam king") but a shopper on
 * a single-dimension PLP has no in-page path to pivot to a sibling
 * dimension. `getCollectionSiblings(handle)` returns the cross-cut
 * groups for the OTHER two dimensions so the PLP can render a
 * "Shop by …" sub-nav. Pivoting within the same dimension isn't useful
 * (someone on the Queen page rarely wants the King page next), so the
 * current dimension is intentionally excluded.
 *
 * All handles below are verified non-empty collections in the inventory
 * snapshot (data/url-inventory/collections.json). Keep this list in sync
 * when collections are added/removed — an entry pointing at an empty or
 * missing collection would render a sub-nav chip that 404s or shows a
 * thin page.
 */

export type SiblingLink = { handle: string; label: string };
export type SiblingGroup = { heading: string; links: SiblingLink[] };

const BRAND_COLLECTIONS: SiblingLink[] = [
  { handle: 'tempur-pedic-mattresses', label: 'Tempur-Pedic' },
  { handle: 'stearns-foster-mattresses', label: 'Stearns & Foster' },
  { handle: 'diamond-mattresses', label: 'Diamond' },
  { handle: 'spring-air-mattresses', label: 'Spring Air' },
  { handle: 'englander-mattresses', label: 'Englander' },
  { handle: 'chattam-wells-mattresses', label: 'Chattam & Wells' },
  { handle: 'eastman-house-mattresses', label: 'Eastman House' },
  { handle: 'southerland-mattresses', label: 'Southerland' },
  { handle: 'harvest-mattresses', label: 'Harvest' },
  { handle: 'helix-mattresses', label: 'Helix' },
  { handle: 'scandinavian-mattresses', label: 'Scandinavian' },
  { handle: 'technogel-mattresses', label: 'Technogel' },
];

const SIZE_COLLECTIONS: SiblingLink[] = [
  { handle: 'twin-size-mattresses', label: 'Twin' },
  { handle: 'twin-xl-mattress-sale', label: 'Twin XL' },
  { handle: 'full-size-mattresses', label: 'Full' },
  { handle: 'queen-size-mattresses', label: 'Queen' },
  { handle: 'king-size-mattresses', label: 'King' },
  { handle: 'california-king-mattresses', label: 'California King' },
  { handle: 'split-king-mattresses', label: 'Split King' },
];

const TYPE_COLLECTIONS: SiblingLink[] = [
  { handle: 'memory-foam-mattresses', label: 'Memory Foam' },
  { handle: 'hybrid-mattresses', label: 'Hybrid' },
  { handle: 'innerspring-mattresses', label: 'Innerspring' },
  { handle: 'latex-mattresses', label: 'Latex' },
  { handle: 'gel-foam-mattresses', label: 'Gel Foam' },
  { handle: 'all-foam-mattresses', label: 'All Foam' },
  { handle: 'pocketed-coil-mattresses', label: 'Pocketed Coil' },
  { handle: 'cooling-mattresses', label: 'Cooling' },
  { handle: 'bed-in-a-box-mattresses', label: 'Bed-in-a-Box' },
  { handle: 'organic-mattress', label: 'Organic' },
];

type Dimension = 'brand' | 'size' | 'type';

const DIMENSION_OF = new Map<string, Dimension>([
  ...BRAND_COLLECTIONS.map((c) => [c.handle, 'brand' as const] as const),
  ...SIZE_COLLECTIONS.map((c) => [c.handle, 'size' as const] as const),
  ...TYPE_COLLECTIONS.map((c) => [c.handle, 'type' as const] as const),
]);

/**
 * For a brand/size/type collection, return the cross-cut sibling groups
 * for the OTHER two dimensions. Returns null for any handle that isn't a
 * recognized single-dimension collection (e.g. `mattresses`, `on-sale`,
 * `best-sellers`) — those get no sub-nav.
 */
export function getCollectionSiblings(handle: string): SiblingGroup[] | null {
  const dim = DIMENSION_OF.get(handle);
  if (!dim) return null;
  const groups: SiblingGroup[] = [];
  if (dim !== 'brand') groups.push({ heading: 'Shop by brand', links: BRAND_COLLECTIONS });
  if (dim !== 'size') groups.push({ heading: 'Shop by size', links: SIZE_COLLECTIONS });
  if (dim !== 'type') groups.push({ heading: 'Shop by type', links: TYPE_COLLECTIONS });
  return groups;
}
