'use client';

import { useCart } from '@/app/_components/cart-context';

type Props = { lineId: string; initialQuantity: number };

export function CartLineEditor({ lineId, initialQuantity }: Props) {
  const { updateLine, removeLine, pending } = useCart();

  return (
    <div className="cart-page-line-editor">
      <div className="cart-qty">
        <button
          type="button"
          className="cart-qty-btn"
          onClick={() => updateLine(lineId, initialQuantity - 1)}
          disabled={pending}
          aria-label="Decrease quantity"
        >−</button>
        <span className="tnum cart-qty-val">{initialQuantity}</span>
        <button
          type="button"
          className="cart-qty-btn"
          onClick={() => updateLine(lineId, initialQuantity + 1)}
          disabled={pending}
          aria-label="Increase quantity"
        >+</button>
      </div>
      <button
        type="button"
        className="cart-line-remove"
        onClick={() => removeLine(lineId)}
        disabled={pending}
      >
        Remove
      </button>
    </div>
  );
}
