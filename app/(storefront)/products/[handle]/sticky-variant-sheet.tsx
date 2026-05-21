'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { ProductOption, ProductVariant } from '@/lib/shopify';
import { isOptionAvailable } from '@/lib/variant-select';
import { useBodyScrollLock } from '@/app/_components/use-body-scroll-lock';
import { useFocusTrap } from '@/app/_components/use-focus-trap';
import { announce } from '@/app/_components/announcer';
import { Icon } from '@/app/_components/icon';
import { formatMoney } from '@/lib/format';
import { SIZE_DIMENSIONS } from './pdp-data';

/**
 * Mobile sticky-ATC variant picker. The sticky bar (mobile-only) used to
 * silently add whatever variant the buy box defaulted to — a shopper who
 * scrolled straight past the buy box couldn't choose a size. When the
 * product has >1 purchasable option combination the sticky CTA now opens
 * this bottom sheet instead of adding directly.
 *
 * Bottom-sheet pattern + a11y kit (scroll lock, focus trap, Esc, focus
 * restore, scrim) mirrors CartDrawer / the PLP mobile filter sheet. CSS
 * (.pdp-variant-sheet*) is gated to <=880px to match the sticky bar.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  options: ProductOption[];
  variants: ProductVariant[];
  selection: Record<string, string>;
  onSelect: (name: string, value: string) => void;
  qty: number;
  onQtyChange: (n: number) => void;
  matchingVariant: ProductVariant | undefined;
  productTitle: string;
  pending: boolean;
  onAdd: () => void;
};

export function StickyVariantSheet({
  open,
  onClose,
  options,
  variants,
  selection,
  onSelect,
  qty,
  onQtyChange,
  matchingVariant,
  productTitle,
  pending,
  onAdd,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useBodyScrollLock(open);
  useFocusTrap(open, sheetRef);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      announce(`Choose options for ${productTitle}`);
      return;
    }
    const target = triggerRef.current;
    triggerRef.current = null;
    if (target && document.contains(target)) {
      requestAnimationFrame(() => target.focus());
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const pickable = options.filter((o) => o.values.length > 1);
  const canAdd = !!matchingVariant?.availableForSale && !pending;

  return (
    <>
      <div className="pdp-variant-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className="pdp-variant-sheet is-open"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose options for ${productTitle}`}
      >
        <div className="pdp-variant-sheet-head">
          <span className="pdp-variant-sheet-title">{productTitle}</span>
          <button type="button" className="pdp-variant-sheet-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="pdp-variant-sheet-body">
          {pickable.map((opt) => {
            const isSize = /size/i.test(opt.name);
            return (
              <div key={opt.id} className="pdp-picker">
                <div className="pdp-picker-head">
                  <span className="eyebrow">{opt.name}</span>
                  {isSize ? (
                    <Link href="/pages/mattress-sizes" className="pdp-size-guide" onClick={onClose}>Size guide</Link>
                  ) : null}
                </div>
                <div className={isSize ? 'pdp-size-grid' : 'pdp-firm-grid'}>
                  {opt.values.map((v) => {
                    const available = isOptionAvailable(variants, selection, opt.name, v);
                    const active = selection[opt.name] === v;
                    const sub = isSize ? SIZE_DIMENSIONS[v] : null;
                    return (
                      <button
                        key={v}
                        type="button"
                        className={`${isSize ? 'pdp-size' : 'pdp-firm'} ${active ? 'on' : ''} ${available ? '' : 'unavailable'}`}
                        onClick={() => onSelect(opt.name, v)}
                        aria-pressed={active}
                        aria-label={available ? undefined : `${v} (unavailable)`}
                      >
                        <span className={isSize ? 'pdp-size-label' : 'pdp-firm-label'}>{v}</span>
                        {sub ? <span className="pdp-size-sub">{sub}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="pdp-qty-row">
            <span className="eyebrow" id="sheet-qty-label">Quantity</span>
            <div className="pdp-stepper" role="group" aria-labelledby="sheet-qty-label">
              <button type="button" onClick={() => onQtyChange(Math.max(1, qty - 1))} aria-label="Decrease quantity" disabled={qty <= 1}>
                <Icon name="minus" size={14} />
              </button>
              <span className="tnum" aria-live="polite" aria-label={`${qty} selected`}>{qty}</span>
              <button type="button" onClick={() => onQtyChange(Math.min(10, qty + 1))} aria-label="Increase quantity" disabled={qty >= 10}>
                <Icon name="plus" size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="pdp-variant-sheet-foot">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!canAdd}
            aria-busy={pending || undefined}
            onClick={onAdd}
          >
            {pending
              ? 'Adding…'
              : matchingVariant?.availableForSale
                ? <>Add to cart{matchingVariant ? <span className="tnum" style={{ opacity: 0.85 }} aria-hidden="true">{' · '}{formatMoney({ amount: (Number.parseFloat(matchingVariant.price.amount) * qty).toFixed(2), currencyCode: matchingVariant.price.currencyCode })}</span> : null}</>
                : 'Out of stock'}
            {canAdd ? <Icon name="cart" size={16} /> : null}
          </button>
        </div>
      </div>
    </>
  );
}
