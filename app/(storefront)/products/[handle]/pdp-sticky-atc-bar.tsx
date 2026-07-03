'use client';

import imageLoader from '@/lib/image-loader';
import type { Image as ShopifyImage } from '@/lib/shopify';

/**
 * Sticky mobile add-to-cart bar — appears after the user scrolls past
 * the main ATC button, mirrors the variant/qty selection, and lets the
 * mobile shopper add to cart without scrolling back up.
 *
 * Phase 209 split: previously inlined at the bottom of `buy-box.tsx`.
 * Moved here as a pure presentational component (no state of its own —
 * the visibility flag, current variant, and add handler come from
 * BuyBox as props), and dynamic-imported from BuyBox so the JS doesn't
 * ship until the IntersectionObserver in BuyBox flips `show` true.
 * Users who never scroll past the main ATC (desktop, or short PDPs)
 * skip the cost of this chunk.
 *
 * CSS hides the bar entirely above 1024px (where the .pdp-grid buy-box
 * rail becomes sticky again), so the show-true case only occurs where
 * the variant bottom-sheet is also available — the two breakpoints
 * must move together (see globals.css, audit ux-pdp-01).
 */
type Props = {
  show: boolean;
  productTitle: string;
  productImage: ShopifyImage | null;
  /** Current selection label (e.g. "Queen" / "Queen · Firm"), if any. */
  variantLabel?: string;
  /** Already-formatted price (`formatMoney(matchingVariant.price)` etc.). */
  price: string;
  /** Pre-computed CTA label — "Adding…" / "Add" / "Out of stock". */
  ctaLabel: string;
  disabled: boolean;
  onAdd: () => void;
  /**
   * When set, the CTA opens the variant bottom-sheet instead of adding
   * directly (multi-option products on mobile, so the shopper can pick a
   * size). Single-variant products leave this undefined and keep the
   * fast direct-add path — no regression for pillows/accessories.
   */
  onCtaClick?: () => void;
};

export function PdpStickyAtcBar({
  show,
  productTitle,
  productImage,
  variantLabel,
  price,
  ctaLabel,
  disabled,
  onAdd,
  onCtaClick,
}: Props) {
  return (
    <div className={`pdp-sticky-bar${show ? ' on' : ''}`} aria-hidden={!show}>
      <div className="pdp-sticky-bar__inner">
        {productImage ? (
          // Plain <img> is fine for a 48px thumb, but the URL must go
          // through the CDN transform: with the raw URL, React 19's SSR
          // image preloading emitted a <link rel="preload"> for the
          // full-resolution original on every PDP, competing with the
          // actual LCP image (audit perf-img-01). 96px = 2x DPR slot.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageLoader({ src: productImage.url, width: 96, quality: 75 })}
            alt={productImage.altText ?? productTitle}
            className="pdp-sticky-bar__img"
            width={48}
            height={48}
          />
        ) : null}
        <div className="pdp-sticky-bar__text">
          <div className="pdp-sticky-bar__title">{productTitle}</div>
          <div className="pdp-sticky-bar__meta">
            {variantLabel ? <span className="pdp-sticky-bar__variant">{variantLabel}</span> : null}
            <span className="pdp-sticky-bar__price tnum">{price}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled && !onCtaClick}
          onClick={onCtaClick ?? onAdd}
          tabIndex={show ? 0 : -1}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
