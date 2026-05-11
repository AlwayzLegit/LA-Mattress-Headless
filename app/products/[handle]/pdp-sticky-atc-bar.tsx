'use client';

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
 * CSS hides the bar entirely on desktop (>880px) so the show-true case
 * is effectively mobile-only.
 */
type Props = {
  show: boolean;
  productTitle: string;
  productImage: ShopifyImage | null;
  /** Already-formatted price (`formatMoney(matchingVariant.price)` etc.). */
  price: string;
  /** Pre-computed CTA label — "Adding…" / "Add" / "Out of stock". */
  ctaLabel: string;
  disabled: boolean;
  onAdd: () => void;
};

export function PdpStickyAtcBar({
  show,
  productTitle,
  productImage,
  price,
  ctaLabel,
  disabled,
  onAdd,
}: Props) {
  return (
    <div className={`pdp-sticky-bar${show ? ' on' : ''}`} aria-hidden={!show}>
      <div className="pdp-sticky-bar__inner">
        {productImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={productImage.url}
            alt={productImage.altText ?? productTitle}
            className="pdp-sticky-bar__img"
            width={48}
            height={48}
          />
        ) : null}
        <div className="pdp-sticky-bar__text">
          <div className="pdp-sticky-bar__title">{productTitle}</div>
          <div className="pdp-sticky-bar__price tnum">{price}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          onClick={onAdd}
          tabIndex={show ? 0 : -1}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
