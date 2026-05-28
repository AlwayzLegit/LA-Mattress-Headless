'use client';

import { useState } from 'react';
import { useCart } from './cart-context';
import { Icon } from './icon';

/**
 * Promo-code input for the cart drawer. Collapsed by default so the
 * footer stays clean; expands inline when the shopper taps "Have a
 * promo code?". Shows currently-applied codes as removable chips when
 * any are active.
 *
 * The cart-context already exposes applyDiscount / removeDiscount
 * which wrap the Storefront cartDiscountCodesUpdate mutation; this
 * component is the UI surface that was missing. Before this, shoppers
 * had to wait until Shopify-hosted checkout to find the discount field
 * — the abandonment-recovery code-search pattern (Google "LA Mattress
 * discount code") is the classic conversion leak this closes.
 *
 * Error states are presented inline (red-text under the input) and
 * cleared on the next submit. Network failures show a generic
 * "couldn't apply" message rather than echoing raw Shopify errors.
 */
export function CartPromoCode() {
  const { cart, applyDiscount, removeDiscount, pending } = useCart();
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter to actually-applicable codes. Shopify will return a code in
  // `discountCodes` even when it's invalid for the cart — the
  // `applicable: false` flag signals "we accepted the input but it's
  // not currently doing anything." We surface only applied codes as
  // chips; invalid codes get cleaned up after the next mutation.
  const applied = (cart?.discountCodes ?? []).filter((d) => d.applicable);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim();
    if (!cleaned) return;
    setSubmitting(true);
    setError(null);
    const res = await applyDiscount(cleaned);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Code couldn’t be applied. Double-check the spelling.');
      return;
    }
    setCode('');
    setExpanded(false);
  };

  const onRemove = async () => {
    setError(null);
    await removeDiscount();
  };

  // Collapsed state — small disclosure link.
  if (!expanded && applied.length === 0) {
    return (
      <button
        type="button"
        className="cart-promo-toggle"
        onClick={() => setExpanded(true)}
        aria-expanded="false"
      >
        Have a promo code?
      </button>
    );
  }

  return (
    <div className="cart-promo">
      {applied.length > 0 ? (
        <div className="cart-promo-applied" aria-live="polite">
          {applied.map((d) => (
            <span key={d.code} className="cart-promo-chip">
              <Icon name="check" size={12} aria-hidden="true" />
              <span className="mono">{d.code}</span>
              <button
                type="button"
                className="cart-promo-chip-remove"
                onClick={onRemove}
                disabled={pending}
                aria-label={`Remove promo code ${d.code}`}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {expanded ? (
        <form className="cart-promo-form" onSubmit={onSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 40))}
            placeholder="Enter code"
            autoComplete="off"
            spellCheck="false"
            disabled={submitting || pending}
            className="cart-promo-input"
            aria-label="Promo code"
            autoFocus
          />
          <button
            type="submit"
            className="cart-promo-submit"
            disabled={submitting || pending || code.trim().length === 0}
          >
            {submitting ? 'Applying…' : 'Apply'}
          </button>
          <button
            type="button"
            className="cart-promo-cancel"
            onClick={() => {
              setExpanded(false);
              setCode('');
              setError(null);
            }}
            aria-label="Cancel"
          >
            <Icon name="close" size={14} />
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="cart-promo-toggle"
          onClick={() => setExpanded(true)}
          aria-expanded="false"
        >
          + Add another code
        </button>
      )}

      {error ? (
        <p className="cart-promo-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
