'use client';

import { Icon } from './icon';
import { announce } from './announcer';
import {
  readWishlistSet,
  useWishlistSet,
  writeWishlistSet,
  type WishlistSnapshot,
} from './wishlist-store';

/**
 * Wishlist heart pinned to the top-right of a PLP card image. One-tap
 * save / unsave during browse-mode, without navigating to the PDP.
 *
 * Matches the Save button on the PDP CTA row (pdp-cta-row.tsx) —
 * same wishlist-store, same announcer, same snapshot shape. Heart
 * fills + flips to "Saved" state when the product is in the set.
 *
 * Lives inside the article as a sibling of the <Link>, NOT inside it
 * (a > button is invalid HTML and breaks tap-to-call patterns on
 * Safari). Absolute-positioned via .plp-card-heart in globals.css;
 * the parent article keeps position: relative so this anchors to
 * the image, not the viewport.
 *
 * Captures vendor / image / price snapshot on save so /wishlist can
 * render a real card per saved mattress without a server fetch —
 * mirrors the snapshot shape PdpCtaRow writes.
 */
export type PlpWishlistHeartProps = {
  handle: string;
  title: string;
  vendor: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
};

export function PlpWishlistHeart({
  handle,
  title,
  vendor,
  imageUrl,
  imageAlt,
  priceAmount,
  priceCurrency,
}: PlpWishlistHeartProps) {
  const { items, hydrated } = useWishlistSet();
  const saved = items.some((p) => p.handle === handle);

  const snapshot = (): WishlistSnapshot => ({
    handle,
    title,
    vendor,
    imageUrl,
    imageAlt,
    priceAmount,
    priceCurrency,
  });

  const onToggle = (e: React.MouseEvent) => {
    // Stop the parent <Link>'s navigation when the heart is tapped.
    e.preventDefault();
    e.stopPropagation();
    const cur = readWishlistSet();
    const idx = cur.findIndex((p) => p.handle === handle);
    const adding = idx < 0;
    if (idx >= 0) cur.splice(idx, 1);
    else cur.push(snapshot());
    writeWishlistSet(cur);
    announce(adding ? `Saved ${title}` : `Removed ${title} from saved`);
  };

  // Don't render until hydrated so SSR matches first paint.
  if (!hydrated) return null;

  return (
    <button
      type="button"
      className={`plp-card-heart${saved ? ' is-on' : ''}`}
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
    >
      <Icon name="heart" size={16} />
    </button>
  );
}
