'use client';

import { Icon } from '@/app/_components/icon';
import { announce } from '@/app/_components/announcer';
import {
  COMPARE_MAX,
  readCompareSet,
  useCompareSet,
  writeCompareSet,
} from '@/app/_components/compare-store';
import {
  readWishlistSet,
  useWishlistSet,
  writeWishlistSet,
  type WishlistSnapshot,
} from '@/app/_components/wishlist-store';

type Props = {
  handle: string;
  title: string;
  vendor?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  priceAmount?: string | null;
  priceCurrency?: string | null;
};

/**
 * Save + Compare buttons rendered just below the Add-to-cart in the PDP
 * rail. Both are localStorage-backed so the state survives across sessions
 * without requiring an account. The Compare set caps at 4 (matches the
 * floating tray and /compare); the wishlist is unbounded for now.
 *
 * Each button toggles its own state independently. Saved state persists
 * across page navigations via the storage event; if the visitor opens this
 * PDP in a second tab and saves there, the heart fills here too.
 *
 * The save snapshot captures vendor / image / price so the /wishlist
 * page renders a real card per saved mattress without a server fetch.
 * Older v1 saves missing those fields still toggle correctly — the
 * wishlist renderer falls back to title-only display.
 *
 * Phase 213: store state managed by the shared `useCompareSet` /
 * `useWishlistSet` hooks. The previous file had inline duplicates of
 * the wishlist constants + a parameterized readSet/writeSet pair;
 * those are gone now.
 */
export function PdpCtaRow({
  handle,
  title,
  vendor,
  imageUrl,
  imageAlt,
  priceAmount,
  priceCurrency,
}: Props) {
  const { items: wishlistItems, hydrated: wishlistHydrated } = useWishlistSet();
  const { items: compareItems, hydrated: compareHydrated } = useCompareSet();

  const hydrated = wishlistHydrated && compareHydrated;
  const saved = wishlistItems.some((p) => p.handle === handle);
  const comparing = compareItems.some((p) => p.handle === handle);

  const wishlistSnapshot = (): WishlistSnapshot => ({
    handle,
    title,
    vendor: vendor ?? null,
    imageUrl: imageUrl ?? null,
    imageAlt: imageAlt ?? null,
    priceAmount: priceAmount ?? null,
    priceCurrency: priceCurrency ?? null,
  });

  const toggleSave = () => {
    const cur = readWishlistSet();
    const idx = cur.findIndex((p) => p.handle === handle);
    const adding = idx < 0;
    if (idx >= 0) cur.splice(idx, 1);
    else cur.push(wishlistSnapshot());
    writeWishlistSet(cur);
    announce(adding ? `Saved ${title}` : `Removed ${title} from saved`);
  };

  const toggleCompare = () => {
    const cur = readCompareSet();
    const idx = cur.findIndex((p) => p.handle === handle);
    if (idx >= 0) {
      cur.splice(idx, 1);
      writeCompareSet(cur);
      announce(`Removed ${title} from compare`);
    } else if (cur.length < COMPARE_MAX) {
      // Compare entries are minimal `{handle, title}` (CompareSnapshot
      // type); the enriched vendor/image/price fields go to wishlist
      // only. Matches the shape `compare-toggle.tsx` writes from the
      // PLP cards.
      cur.push({ handle, title });
      writeCompareSet(cur);
      announce(`Added ${title} to compare. ${cur.length} of ${COMPARE_MAX} selected.`);
    } else {
      // Cap reached — surface it audibly so SR users aren't met with
      // a silent no-op when they try to add a 5th item.
      announce(`Compare is full. Remove one of the ${COMPARE_MAX} selected mattresses first.`);
    }
  };

  // Don't render until hydrated so SSR matches first paint.
  if (!hydrated) return null;

  return (
    <div className="pdp-cta-row">
      <button
        type="button"
        className={`btn btn-ghost pdp-wishlist${saved ? ' is-on' : ''}`}
        onClick={toggleSave}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      >
        <Icon name="heart" size={16} />
        {saved ? 'Saved' : 'Save'}
      </button>
      <button
        type="button"
        className={`btn btn-ghost${comparing ? ' is-on' : ''}`}
        onClick={toggleCompare}
        aria-pressed={comparing}
        aria-label={comparing ? `Remove ${title} from compare` : `Add ${title} to compare`}
      >
        <Icon name={comparing ? 'check' : 'plus'} size={16} />
        {comparing ? 'In compare' : 'Compare'}
      </button>
    </div>
  );
}
