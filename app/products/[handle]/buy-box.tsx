'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Image, Money, ProductOption, ProductVariant } from '@/lib/shopify';
import { useCart } from '@/app/_components/cart-context';
import { Icon } from '@/app/_components/icon';
import { formatMoney, formatPriceRange } from '@/lib/format';
import { SITE_PHONE_DISPLAY } from '@/lib/site-config';

type Props = {
  options: ProductOption[];
  variants: ProductVariant[];
  // Fallbacks when no variant is selected — pre-streamed from the server so
  // the buy box renders before hydration with sensible numbers.
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  compareAtPriceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  // Used by the sticky mobile bar.
  productTitle: string;
  productImage: Image | null;
};

export function BuyBox({ options, variants, priceRange, compareAtPriceRange, productTitle, productImage }: Props) {
  const initial = useMemo(() => {
    const first = variants.find((v) => v.availableForSale) ?? variants[0];
    const out: Record<string, string> = {};
    for (const o of first?.selectedOptions ?? []) out[o.name] = o.value;
    return out;
  }, [variants]);

  const [selection, setSelection] = useState<Record<string, string>>(initial);
  const { addLine, pending } = useCart();

  const matchingVariant = useMemo(
    () => variants.find((v) => v.selectedOptions.every((o) => selection[o.name] === o.value)),
    [variants, selection],
  );

  function isAvailable(name: string, value: string): boolean {
    return variants.some((v) => {
      if (!v.availableForSale) return false;
      return v.selectedOptions.every((o) =>
        o.name === name ? o.value === value : selection[o.name] === o.value,
      );
    });
  }

  // Find the variant that would result from clicking a chip — used to show
  // its price inline. Falls back to any variant matching just this option
  // value when the cross-selection has no exact match.
  function variantForChip(name: string, value: string): ProductVariant | undefined {
    const exact = variants.find((v) =>
      v.selectedOptions.every((o) => (o.name === name ? o.value === value : selection[o.name] === o.value)),
    );
    if (exact) return exact;
    return variants.find((v) => v.selectedOptions.some((o) => o.name === name && o.value === value));
  }

  // Only show prices on chips when there's meaningful variation (>$1 spread
  // across the option). Saves clutter on products where every size is the
  // same price.
  function shouldShowPriceForOption(name: string): boolean {
    const prices = new Set<number>();
    for (const v of variants) {
      const matchesName = v.selectedOptions.some((o) => o.name === name);
      if (!matchesName) continue;
      prices.add(Number.parseFloat(v.price.amount));
    }
    if (prices.size < 2) return false;
    const arr = Array.from(prices);
    return Math.max(...arr) - Math.min(...arr) >= 1;
  }

  const canBuy = !!matchingVariant?.availableForSale && !pending;

  // Sticky mobile add-to-cart bar: appears only after the user scrolls past
  // the main ATC button. We observe its visibility via IntersectionObserver
  // and toggle a class. CSS hides it entirely on desktop (>880px).
  const atcRef = useRef<HTMLButtonElement | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const target = atcRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  // Variant-specific price beats the range. Fall back to the range only if
  // no variant matches the current selection (edge case: cleared selection).
  const variantOnSale =
    !!matchingVariant?.compareAtPrice &&
    Number.parseFloat(matchingVariant.compareAtPrice.amount) >
      Number.parseFloat(matchingVariant.price.amount);
  const rangeOnSale =
    Number.parseFloat(compareAtPriceRange.minVariantPrice.amount) > 0 &&
    Number.parseFloat(compareAtPriceRange.minVariantPrice.amount) >
      Number.parseFloat(priceRange.minVariantPrice.amount);

  return (
    <>
      <div className="pdp-price">
        {matchingVariant ? (
          variantOnSale ? (
            <>
              <span className="pcard-was tnum">{formatMoney(matchingVariant.compareAtPrice!)}</span>
              <span className="pcard-now tnum" style={{ color: 'var(--sale)' }}>
                {formatMoney(matchingVariant.price)}
              </span>
              <span className="pdp-save tnum" style={{ color: 'var(--sale)', marginLeft: 'var(--s-2)', fontWeight: 600 }}>
                Save{' '}
                {formatMoney({
                  amount: (
                    Number.parseFloat(matchingVariant.compareAtPrice!.amount) -
                    Number.parseFloat(matchingVariant.price.amount)
                  ).toFixed(2),
                  currencyCode: matchingVariant.price.currencyCode,
                })}
              </span>
            </>
          ) : (
            <span className="pcard-now tnum">{formatMoney(matchingVariant.price)}</span>
          )
        ) : rangeOnSale ? (
          <>
            <span className="pcard-was tnum">{formatPriceRange(compareAtPriceRange.minVariantPrice, compareAtPriceRange.maxVariantPrice)}</span>
            <span className="pcard-now tnum" style={{ color: 'var(--sale)' }}>
              {formatPriceRange(priceRange.minVariantPrice, priceRange.maxVariantPrice)}
            </span>
          </>
        ) : (
          <span className="pcard-now tnum">{formatPriceRange(priceRange.minVariantPrice, priceRange.maxVariantPrice)}</span>
        )}
      </div>

      {options.length > 0 ? (
        <div className="pdp-options">
          {options.map((opt) => (
            <div key={opt.id} className="pdp-option">
              <div className="pdp-option-label">
                <span className="eyebrow">{opt.name}</span>
                <span className="pdp-option-value">{selection[opt.name]}</span>
              </div>
              <div className="pdp-option-values">
                {opt.values.map((v) => {
                  const available = isAvailable(opt.name, v);
                  const active = selection[opt.name] === v;
                  const showPrice = shouldShowPriceForOption(opt.name);
                  const variantForThisChip = showPrice ? variantForChip(opt.name, v) : undefined;
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`pdp-option-chip ${active ? 'on' : ''} ${available ? '' : 'unavailable'}`}
                      onClick={() => setSelection((s) => ({ ...s, [opt.name]: v }))}
                      aria-pressed={active}
                      aria-label={`${opt.name}: ${v}${variantForThisChip ? `, ${formatMoney(variantForThisChip.price)}` : ''}${available ? '' : ' (unavailable)'}`}
                    >
                      <span className="pdp-option-chip-label">{v}</span>
                      {variantForThisChip ? (
                        <span className="pdp-option-chip-price tnum">{formatMoney(variantForThisChip.price)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <button
        ref={atcRef}
        type="button"
        className="btn btn-primary btn-lg"
        style={{ width: '100%', marginTop: 'var(--s-5)' }}
        disabled={!canBuy}
        onClick={() => matchingVariant && addLine(matchingVariant.id, 1)}
      >
        {pending ? 'Adding…' : matchingVariant?.availableForSale ? 'Add to cart' : 'Out of stock'}
        {canBuy ? <Icon name="cart" size={16} /> : null}
      </button>

      {matchingVariant && !matchingVariant.availableForSale ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 'var(--s-3)' }}>
          This combination is currently out of stock. Call {SITE_PHONE_DISPLAY} for availability.
        </p>
      ) : null}

      <div className={`pdp-sticky-bar${showSticky ? ' on' : ''}`} aria-hidden={!showSticky}>
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
            <div className="pdp-sticky-bar__price tnum">
              {matchingVariant ? formatMoney(matchingVariant.price) : formatMoney(priceRange.minVariantPrice)}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canBuy}
            onClick={() => matchingVariant && addLine(matchingVariant.id, 1)}
            tabIndex={showSticky ? 0 : -1}
          >
            {pending ? 'Adding…' : matchingVariant?.availableForSale ? 'Add' : 'Out of stock'}
          </button>
        </div>
      </div>
    </>
  );
}
