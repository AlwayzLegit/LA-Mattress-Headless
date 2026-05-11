import type { CollectionSort } from '@/lib/shopify';

/**
 * PLP sort options. Shared by the server page (initial render) and the
 * `/api/load-more-products` API route (Phase 217 client-side append) so
 * both sides agree on the value-to-{sortKey, reverse} mapping. Lifted
 * out of `page.tsx` in Phase 216 — was previously inline.
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
