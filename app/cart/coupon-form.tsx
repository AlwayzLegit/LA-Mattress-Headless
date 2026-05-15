'use client';

import { useState } from 'react';
import { useCart } from '@/app/_components/cart-context';
import { Icon } from '@/app/_components/icon';

/**
 * Discount-code input for the cart summary. Applied codes render as a
 * removable chip. The actual codes must exist in Shopify Admin →
 * Discounts; this only applies/removes them. An invalid code surfaces
 * an inline error (the server action detects the silent
 * applicable:false the Storefront API returns).
 */
export function CouponForm() {
  const { cart, applyDiscount, removeDiscount } = useCart();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applied = (cart?.discountCodes ?? []).filter((d) => d.applicable);

  async function onApply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await applyDiscount(code);
    setBusy(false);
    if (res.ok) setCode('');
    else setError(res.error ?? 'Could not apply code');
  }

  return (
    <div className="cart-coupon">
      {applied.length > 0 ? (
        <ul className="cart-coupon-applied" aria-label="Applied discounts">
          {applied.map((d) => (
            <li key={d.code} className="cart-coupon-chip">
              <Icon name="check" size={13} aria-hidden />
              <span>{d.code}</span>
              <button
                type="button"
                onClick={() => removeDiscount()}
                aria-label={`Remove discount ${d.code}`}
                className="cart-coupon-remove"
              >
                <Icon name="close" size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form className="cart-coupon-form" onSubmit={onApply}>
          <label htmlFor="cart-coupon-input" className="cart-coupon-label">Discount code</label>
          <div className="cart-coupon-row">
            <input
              id="cart-coupon-input"
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              placeholder="Enter code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="cart-coupon-input"
            />
            <button type="submit" className="btn btn-ghost cart-coupon-apply" disabled={busy || !code.trim()}>
              {busy ? 'Applying…' : 'Apply'}
            </button>
          </div>
          {error ? <p className="cart-coupon-error" role="alert">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
