'use client';

import { useCart } from '@/app/_components/cart-context';
import { readWishlistSet, writeWishlistSet, type WishlistSnapshot } from '@/app/_components/wishlist-store';

type Props = {
  lineId: string;
  initialQuantity: number;
  /**
   * Product title for SR-context aria-labels. Optional so existing
   * call sites that haven't been updated still render — falls back
   * to the generic "this product" wording in that case. Cart page
   * already has the title in scope; passing it lets SR users
   * disambiguate which line they're editing.
   */
  productTitle?: string;
  /**
   * When provided, renders a "Save for later" action that moves the
   * line into the wishlist (dedup by handle) and removes it from cart.
   */
  saveSnapshot?: WishlistSnapshot;
};

export function CartLineEditor({ lineId, initialQuantity, productTitle, saveSnapshot }: Props) {
  const { updateLine, removeLine, pending } = useCart();
  const ofWhat = productTitle ?? 'this product';

  function saveForLater() {
    if (!saveSnapshot) return;
    const existing = readWishlistSet().filter((x) => x.handle !== saveSnapshot.handle);
    writeWishlistSet([saveSnapshot, ...existing]);
    removeLine(lineId);
  }

  return (
    <div className="cart-page-line-editor">
      <div className="cart-qty" role="group" aria-label={`Quantity for ${ofWhat}`}>
        <button
          type="button"
          className="cart-qty-btn"
          onClick={() => updateLine(lineId, initialQuantity - 1)}
          disabled={pending}
          aria-label={`Decrease quantity of ${ofWhat}`}
        >−</button>
        <span
          className="tnum cart-qty-val"
          aria-live="polite"
          aria-label={`${initialQuantity} in cart`}
        >
          {initialQuantity}
        </span>
        <button
          type="button"
          className="cart-qty-btn"
          onClick={() => updateLine(lineId, initialQuantity + 1)}
          disabled={pending}
          aria-label={`Increase quantity of ${ofWhat}`}
        >+</button>
      </div>
      {saveSnapshot ? (
        <button
          type="button"
          className="cart-line-save"
          onClick={saveForLater}
          disabled={pending}
          aria-label={`Save ${ofWhat} for later`}
        >
          Save for later
        </button>
      ) : null}
      <button
        type="button"
        className="cart-line-remove"
        onClick={() => removeLine(lineId)}
        disabled={pending}
        aria-label={`Remove ${ofWhat} from cart`}
      >
        Remove
      </button>
    </div>
  );
}
