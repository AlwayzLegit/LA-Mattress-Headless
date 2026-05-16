'use client';

import { createLocalStoreApi, useLocalStoreSync } from './use-local-store';

/**
 * Wishlist localStorage store — Phase 213 extraction.
 *
 * Previously `wishlist-view.tsx` and `pdp-cta-row.tsx` each held their
 * own copy of `WISHLIST_KEY` / `WISHLIST_EVENT` plus a near-identical
 * `Snapshot` type, `readSet`, `writeSet`, and useEffect-with-listeners
 * sync pattern. Centralized here against the Phase 211 generic helpers.
 *
 * `WishlistSnapshot` carries optional `vendor` / `imageUrl` / `imageAlt`
 * / `priceAmount` / `priceCurrency` so the `/wishlist` page can render
 * a real card without a Shopify roundtrip. Snapshots from earlier
 * versions of this client (v1-era saves with only `handle` + `title`)
 * still pass the `isValid` predicate; the wishlist renderer falls back
 * to title-only display for those.
 *
 * No `max` cap — the wishlist is unbounded for now (compare's 4-item
 * cap is product-specific to the table rendering).
 */

export const WISHLIST_STORAGE_KEY = 'la-mattress.wishlist.v1';
export const WISHLIST_EVENT = 'la-mattress:wishlist-change';

export type WishlistSnapshot = {
  handle: string;
  title: string;
  vendor?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  priceAmount?: string | null;
  priceCurrency?: string | null;
};

const WISHLIST_API = createLocalStoreApi<WishlistSnapshot>({
  key: WISHLIST_STORAGE_KEY,
  event: WISHLIST_EVENT,
  isValid: (x): x is WishlistSnapshot =>
    typeof x === 'object' && x != null && 'handle' in x,
});

export const readWishlistSet = WISHLIST_API.read;
export const writeWishlistSet = WISHLIST_API.write;

/**
 * React hook: hydrates the current wishlist and re-renders the caller
 * when items change (this tab or another). Same `{ items, hydrated }`
 * shape as `useCompareSet`.
 */
export function useWishlistSet() {
  return useLocalStoreSync(WISHLIST_API);
}
