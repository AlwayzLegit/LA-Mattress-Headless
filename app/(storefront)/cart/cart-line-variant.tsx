'use client';

import { useState } from 'react';
import type { ProductOption, ProductVariant, SelectedOption } from '@/lib/shopify';
import { useCart } from '@/app/_components/cart-context';
import { getLineSwapOptions } from '@/app/_actions/cart';
import { findVariant, isOptionAvailable } from '@/lib/variant-select';
import { Icon } from '@/app/_components/icon';

/**
 * In-cart variant editor. Renders the line's current options as text
 * plus a "Change" toggle; on first open it lazy-fetches the product's
 * full option/variant matrix (so the cart read stays lean) and renders
 * compact chips. Picking a combination swaps the line's merchandiseId
 * in place via cartLinesUpdate (no remove + re-add).
 *
 * Known v1 limitation: swapping to a variant already present as another
 * cart line won't auto-merge (Shopify keeps them separate); the returned
 * cart is authoritative.
 */
export function CartLineVariant({
  lineId,
  handle,
  quantity,
  selectedOptions,
}: {
  lineId: string;
  handle: string;
  quantity: number;
  selectedOptions: SelectedOption[];
}) {
  const { changeVariant } = useCart();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<{ options: ProductOption[]; variants: ProductVariant[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const current: Record<string, string> = {};
  for (const o of selectedOptions) current[o.name] = o.value;
  const summary = selectedOptions.map((o) => `${o.name}: ${o.value}`).join(' · ');

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (!loaded && !loading) {
      setLoading(true);
      const res = await getLineSwapOptions(handle);
      setLoaded(res);
      setLoading(false);
    }
  }

  async function pick(name: string, value: string) {
    if (!loaded || busy) return;
    const next = { ...current, [name]: value };
    const variant = findVariant(loaded.variants, next);
    if (!variant) return;
    const isSameAsCurrent = loaded.variants.length
      ? findVariant(loaded.variants, current)?.id === variant.id
      : false;
    if (isSameAsCurrent) { setOpen(false); return; }
    setBusy(true);
    const res = await changeVariant(lineId, variant.id, quantity);
    setBusy(false);
    if (res.ok) setOpen(false);
  }

  const editable = (loaded?.options ?? []).filter((o) => o.values.length > 1);

  return (
    <div className="cart-line-variant">
      <div className="cart-line-variant-row">
        <span className="muted cart-line-variant-summary">{summary || 'Default'}</span>
        <button
          type="button"
          className="cart-line-variant-toggle"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Change size or options"
        >
          {open ? 'Done' : 'Change'} <Icon name="chevron-down" size={12} aria-hidden />
        </button>
      </div>
      {open ? (
        <div className="cart-line-variant-panel">
          {loading ? (
            <p className="muted" style={{ fontSize: 13 }}>Loading options…</p>
          ) : !loaded || editable.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No other options available.</p>
          ) : (
            editable.map((opt) => (
              <div key={opt.id} className="cart-line-variant-opt">
                <span className="eyebrow">{opt.name}</span>
                <div className="cart-line-variant-chips">
                  {opt.values.map((v) => {
                    const active = current[opt.name] === v;
                    const available = isOptionAvailable(loaded.variants, current, opt.name, v);
                    return (
                      <button
                        key={v}
                        type="button"
                        className={`cart-line-variant-chip ${active ? 'on' : ''} ${available ? '' : 'unavailable'}`}
                        onClick={() => pick(opt.name, v)}
                        disabled={busy || active}
                        aria-pressed={active}
                        aria-label={available ? v : `${v} (unavailable)`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
