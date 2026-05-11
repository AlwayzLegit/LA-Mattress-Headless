'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Image, Money, ProductOption, ProductVariant } from '@/lib/shopify';
import { useCart } from '@/app/_components/cart-context';
import { Icon } from '@/app/_components/icon';
import { announce } from '@/app/_components/announcer';
import { formatMoney, formatPriceRange } from '@/lib/format';
import { SITE_PHONE_DISPLAY } from '@/lib/site-config';
import { SIZE_DIMENSIONS } from './pdp-data';

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
  const [qty, setQty] = useState(1);
  const { addLine, pending } = useCart();

  // Reset quantity to 1 whenever the user changes the variant — total
  // shouldn't carry across selections.
  useEffect(() => { setQty(1); }, [selection]);

  const matchingVariant = useMemo(
    () => variants.find((v) => v.selectedOptions.every((o) => selection[o.name] === o.value)),
    [variants, selection],
  );

  // Announce the current variant + price after the visitor changes a
  // size / firmness / etc. — sighted users see the price + ATC label
  // update; SR users got nothing without this. Skip the initial mount
  // (`isInitialRef`) so just landing on the PDP doesn't fire an
  // announcement of the default selection.
  const isInitialRef = useRef(true);
  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }
    if (!matchingVariant) {
      announce('That combination is not available.');
      return;
    }
    const sizeOpt = matchingVariant.selectedOptions.find((o) => /size/i.test(o.name));
    const otherOpts = matchingVariant.selectedOptions.filter((o) => !/size/i.test(o.name));
    const labelParts = [
      sizeOpt ? `${sizeOpt.value} size` : null,
      ...otherOpts.map((o) => o.value),
      formatMoney(matchingVariant.price),
      matchingVariant.availableForSale ? null : 'currently out of stock',
    ].filter(Boolean);
    announce(labelParts.join(', '));
  }, [matchingVariant]);

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
      <div className="pdp-price-row">
        {matchingVariant ? (
          variantOnSale ? (
            <>
              <span className="pdp-was tnum">{formatMoney(matchingVariant.compareAtPrice!)}</span>
              <span className="pdp-now tnum">{formatMoney(matchingVariant.price)}</span>
              <span className="pdp-save tnum">
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
            <span className="pdp-now tnum">{formatMoney(matchingVariant.price)}</span>
          )
        ) : rangeOnSale ? (
          <>
            <span className="pdp-was tnum">{formatPriceRange(compareAtPriceRange.minVariantPrice, compareAtPriceRange.maxVariantPrice)}</span>
            <span className="pdp-now tnum">{formatPriceRange(priceRange.minVariantPrice, priceRange.maxVariantPrice)}</span>
          </>
        ) : (
          <span className="pdp-now tnum">{formatPriceRange(priceRange.minVariantPrice, priceRange.maxVariantPrice)}</span>
        )}
      </div>

      {options.filter((o) => o.values.length > 1).length > 0 ? (
        <div className="pdp-options">
          {options.filter((o) => o.values.length > 1).map((opt) => {
            const isSize = /size/i.test(opt.name);
            return (
              <div key={opt.id} className="pdp-picker">
                <div className="pdp-picker-head">
                  <span className="eyebrow">{opt.name}</span>
                  {isSize ? (
                    <Link href="/pages/mattress-sizes" className="pdp-size-guide">Size guide</Link>
                  ) : null}
                </div>
                <div className={isSize ? 'pdp-size-grid' : 'pdp-firm-grid'}>
                  {opt.values.map((v) => {
                    const available = isAvailable(opt.name, v);
                    const active = selection[opt.name] === v;
                    const showPrice = isSize || shouldShowPriceForOption(opt.name);
                    const variantForThisChip = showPrice ? variantForChip(opt.name, v) : undefined;
                    const sub = isSize ? SIZE_DIMENSIONS[v] : null;
                    return (
                      <button
                        key={v}
                        type="button"
                        className={`${isSize ? 'pdp-size' : 'pdp-firm'} ${active ? 'on' : ''} ${available ? '' : 'unavailable'}`}
                        onClick={() => setSelection((s) => ({ ...s, [opt.name]: v }))}
                        aria-pressed={active}
                        aria-label={available ? undefined : `${v} (unavailable)`}
                      >
                        <span className={isSize ? 'pdp-size-label' : 'pdp-firm-label'}>{v}</span>
                        {sub ? <span className="pdp-size-sub">{sub}</span> : null}
                        {variantForThisChip ? (
                          <span className={isSize ? 'pdp-size-price tnum' : 'pdp-firm-sub muted tnum'}>
                            {formatMoney(variantForThisChip.price)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="pdp-qty-row">
        <span className="eyebrow" id="pdp-qty-label">Quantity</span>
        <div className="pdp-stepper" role="group" aria-labelledby="pdp-qty-label">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" disabled={qty <= 1}>
            <Icon name="minus" size={14} />
          </button>
          <span className="tnum" aria-live="polite" aria-label={`${qty} selected`}>{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Increase quantity" disabled={qty >= 10}>
            <Icon name="plus" size={14} />
          </button>
        </div>
      </div>

      <button
        ref={atcRef}
        type="button"
        className="btn btn-primary btn-lg pdp-cta"
        disabled={!canBuy}
        // aria-busy explicitly signals the in-flight add. The visible
        // "Adding…" label + disabled state already convey this, but
        // aria-busy is the programmatic equivalent some AT use to
        // suppress duplicate announcements while a control is working.
        aria-busy={pending || undefined}
        onClick={() => matchingVariant && addLine(matchingVariant.id, qty)}
      >
        {pending ? 'Adding…' : matchingVariant?.availableForSale ? (
          <>
            Add to cart{' '}
            {/* The price echo is a sighted-user convenience. SR users
                already hear the price when the variant selection
                changes (Phase 114) and again post-add via cart-context
                (Phase 142). Marking it aria-hidden avoids "Add to
                cart, middle dot, $2,599" punctuation noise. */}
            <span className="tnum" style={{ opacity: 0.85 }} aria-hidden="true">
              · {formatMoney({
                amount: (Number.parseFloat(matchingVariant.price.amount) * qty).toFixed(2),
                currencyCode: matchingVariant.price.currencyCode,
              })}
            </span>
          </>
        ) : 'Out of stock'}
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
