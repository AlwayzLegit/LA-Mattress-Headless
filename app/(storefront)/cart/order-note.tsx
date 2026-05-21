'use client';

import { useRef, useState } from 'react';
import { useCart } from '@/app/_components/cart-context';

/**
 * Optional order note saved to the Shopify cart (carries through to the
 * order). Debounced: persists on blur or 1.2s after the last keystroke
 * so we don't fire a mutation per character.
 */
export function OrderNote() {
  const { cart, setNote } = useCart();
  const [value, setValue] = useState(cart?.note ?? '');
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(cart?.note ?? '');

  function persist(v: string) {
    if (v === lastSaved.current) return;
    lastSaved.current = v;
    setNote(v).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(v), 1200);
  }

  function onBlur() {
    if (timer.current) clearTimeout(timer.current);
    persist(value);
  }

  return (
    <details className="cart-note">
      <summary className="cart-note-summary">Add an order note</summary>
      <textarea
        className="cart-note-input"
        rows={3}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="Delivery instructions, gate code, preferred timing…"
        aria-label="Order note"
        maxLength={500}
      />
      <span className="cart-note-status muted" aria-live="polite">
        {saved ? 'Saved' : ''}
      </span>
    </details>
  );
}
