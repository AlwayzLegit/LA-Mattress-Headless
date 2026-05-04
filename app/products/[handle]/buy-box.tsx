'use client';

import { useMemo, useState } from 'react';
import type { ProductOption, ProductVariant } from '@/lib/shopify';
import { useCart } from '@/app/_components/cart-context';
import { Icon } from '@/app/_components/icon';

type Props = {
  options: ProductOption[];
  variants: ProductVariant[];
};

export function BuyBox({ options, variants }: Props) {
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

  const canBuy = !!matchingVariant?.availableForSale && !pending;

  return (
    <>
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
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`pdp-option-chip ${active ? 'on' : ''} ${available ? '' : 'unavailable'}`}
                      onClick={() => setSelection((s) => ({ ...s, [opt.name]: v }))}
                      aria-pressed={active}
                      aria-label={`${opt.name}: ${v}${available ? '' : ' (unavailable)'}`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <button
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
          This combination is currently out of stock. Call (213) 555-0142 for availability.
        </p>
      ) : null}
    </>
  );
}
