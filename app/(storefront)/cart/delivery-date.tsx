'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/app/_components/cart-context';
import { Icon } from '@/app/_components/icon';

/**
 * Cart-page delivery-date picker. The chosen date is saved as a Shopify
 * cart attribute (see setDeliveryDate action), which carries through to
 * the order so the fulfilment team sees it in Admin. This is a
 * *requested* date — Shopify's hosted checkout can't be modified from a
 * headless storefront, so we capture intent here and confirm by phone.
 *
 * The date <input>, min/max, and the formatted confirmation render only
 * after mount: `new Date()` differs between the server render and the
 * client hydrate at a day boundary, which would be a hydration
 * mismatch. The static heading/help text SSR normally.
 */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DeliveryDate({ initialDate }: { initialDate: string | null }) {
  const { setDeliveryDate } = useCart();
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState<string>(initialDate ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => setMounted(true), []);

  const today = new Date();
  const min = new Date(today);
  min.setDate(min.getDate() + 1);
  const max = new Date(today);
  max.setDate(max.getDate() + 60);

  async function save(next: string | null) {
    setSaving(true);
    try {
      await setDeliveryDate(next);
    } finally {
      setSaving(false);
    }
  }

  const pretty =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })
      : null;

  return (
    <section className="cart-delivery" aria-labelledby="cart-delivery-h">
      <div className="eyebrow" id="cart-delivery-h">
        <Icon name="truck" size={14} /> Preferred delivery date
      </div>
      <p className="muted cart-delivery-help">
        Pick the day you&apos;d like white-glove delivery. We&apos;ll confirm the
        window by phone — most LA orders deliver within 1–3 days.
      </p>

      {mounted ? (
        <div className="cart-delivery-row">
          <input
            type="date"
            className="cart-delivery-field"
            aria-label="Requested delivery date"
            value={value}
            min={ymd(min)}
            max={ymd(max)}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value;
              setValue(v);
              if (v) void save(v);
            }}
          />
          {value ? (
            <button
              type="button"
              className="btn btn-ghost cart-delivery-clear"
              disabled={saving}
              onClick={() => {
                setValue('');
                void save(null);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {pretty ? (
        <p className="cart-delivery-confirm" role="status">
          <Icon name="check" size={14} /> Requested for {pretty}
          {saving ? ' — saving…' : ''}
        </p>
      ) : null}
    </section>
  );
}
