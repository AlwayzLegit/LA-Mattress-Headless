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

// SEMrush 20260521_1 follow-up — these are real, populated collections
// that scored "Pages with only one internal link" because they don't fit
// the brand/size/type taxonomy. Surfacing them as a fourth sibling group
// on every brand/size/type PLP adds ~30 inbound links each (one per PLP)
// and gives shoppers a path to high-intent feel / featured cross-cuts.
const FEATURED_COLLECTIONS: SiblingLink[] = [
  { handle: 'best-sellers', label: 'Best sellers' },
  { handle: 'luxury-mattresses', label: 'Luxury' },
  { handle: 'soft-mattresses-for-pressure-relief', label: 'Pressure-relief soft' },
  { handle: 'cooling-pillows', label: 'Cooling pillows' },
  { handle: 'tempur-pedic-adjustable-bases', label: 'Tempur-Pedic bases' },
];

type Dimension = 'brand' | 'size' | 'type' | 'featured';

const DIMENSION_OF = new Map<string, Dimension>([
  ...BRAND_COLLECTIONS.map((c) => [c.handle, 'brand' as const] as const),
  ...SIZE_COLLECTIONS.map((c) => [c.handle, 'size' as const] as const),
  ...TYPE_COLLECTIONS.map((c) => [c.handle, 'type' as const] as const),
  ...FEATURED_COLLECTIONS.map((c) => [c.handle, 'featured' as const] as const),
]);

/**
 * For a brand/size/type/featured collection, return the cross-cut
 * sibling groups for the OTHER dimensions. Returns null for any handle
 * that isn't a recognized cross-cut collection (e.g. `mattresses`,
 * `on-sale`) — those get no sub-nav.
 *
 * `featured` collections (best-sellers, luxury, pressure-relief, cooling
 * pillows, tempur adjustable bases) get all three brand/size/type groups
 * + the featured group minus themselves — they're the most genuine
 * "shop other ways" entry points since they don't impose a brand/size/
 * type constraint of their own.
 */
export function getCollectionSiblings(handle: string): SiblingGroup[] | null {
  const dim = DIMENSION_OF.get(handle);
  if (!dim) return null;
  const groups: SiblingGroup[] = [];
  if (dim !== 'brand') groups.push({ heading: 'Shop by brand', links: BRAND_COLLECTIONS });
  if (dim !== 'size') groups.push({ heading: 'Shop by size', links: SIZE_COLLECTIONS });
  if (dim !== 'type') groups.push({ heading: 'Shop by type', links: TYPE_COLLECTIONS });
  // Featured group always renders — including when the user is already
  // on a featured PLP (the current page is suppressed by aria-current
  // styling in the consumer). Adding it to every brand/size/type PLP
  // is the whole point.
  const featured = FEATURED_COLLECTIONS.filter((c) => c.handle !== handle);
  if (featured.length) groups.push({ heading: 'Featured', links: featured });
  return groups;
}
