import type { CollectionSort } from '@/lib/shopify';

/**
 * PLP sort options. Shared by the server page (initial render) and the
 * `/api/load-more-products` API route (Phase 217 client-side append) so
 * both sides agree on the value-to-{sortKey, reverse} mapping. Lifted
 * out of `page.tsx` in Phase 216 — was previously inline.
 *
 * ## Known Shopify sort quirk (Phase 222 investigation)
 *
 * Shopify's `ProductCollectionSortKeys.PRICE` sorts products by a
 * single canonical price value per product — empirically not the same
 * as `priceRange.minVariantPrice` (the value we display on the card).
 * For multi-variant mattresses ranging Twin → California King, that
 * means the visible order under "Price: low to high" is not strictly
 * monotone in the displayed FROM-price: e.g. cards may show
 * `$399, $399, $1099, $599, $599, $699`. Shopify is sorting on its
 * own price field (likely the first variant's price or an aggregate),
 * and our card chooses to display the cheapest variant's price for
 * better marketing.
 *
 * Tradeoffs of "fixing" this:
 *   - True client-side re-sort by `minVariantPrice` would require
 *     fetching the full collection (no pagination) — regression for
 *     big collections (Mattresses has ~150 products).
 *   - Renaming the sort option to just "Price" hides the issue but
 *     also drops the user signal of which direction.
 *   - Switching the card display to the first-variant price would
 *     match the sort order but loses the "from $399" marketing pitch
 *     that's typical on mattress PLPs.
 *
 * For now: keep the labels and accept the apparent ordering quirk.
 * If merchant feedback after launch escalates this, the cleanest fix
 * is probably (b) — rename to "Price (ascending)" and add a sublabel
 * "by base price". Cowork pre-launch audit P2-4 flagged this.
 */
export const SORT_OPTIONS: { value: CollectionSort; label: string; reverse?: boolean }[] = [
  { value: 'COLLECTION_DEFAULT', label: 'Featured' },
  { value: 'PRICE',              label: 'Price: low to high' },
  { value: 'PRICE',              label: 'Price: high to low', reverse: true },
  { value: 'BEST_SELLING',       label: 'Best selling' },
  { value: 'CREATED',            label: 'Newest', reverse: true },
];

/**
 * Resolve a sort param (e.g. `"PRICE"` or `"PRICE-r"`) to its
 * `{ sortKey, reverse, index }` triple. Unknown / missing values fall
 * through to index 0 (COLLECTION_DEFAULT).
 */
export function parseSort(raw: string | undefined): {
  sortKey: CollectionSort;
  reverse: boolean;
  index: number;
} {
  const idx = SORT_OPTIONS.findIndex((o) => `${o.value}${o.reverse ? '-r' : ''}` === raw);
  const i = idx >= 0 ? idx : 0;
  const opt = SORT_OPTIONS[i];
  return { sortKey: opt.value, reverse: opt.reverse ?? false, index: i };
}
