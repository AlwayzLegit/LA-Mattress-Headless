'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import type { Cart } from '@/lib/shopify';
import {
  addToCart as addAction,
  updateCartLine,
  removeCartLine,
  applyDiscountCode,
  removeDiscountCode,
  changeLineVariant,
  updateCartNote,
  setDeliveryDate as setDeliveryDateAction,
  setAnalyticsAttribution,
  readCart,
} from '@/app/_actions/cart';
import { announce, announceAssertive } from './announcer';
import { track } from '@/lib/analytics';
import { withPostHog } from '@/lib/ph';
import { POSTHOG_DISTINCT_ID_KEY } from '@/lib/cart-attributes';
import { sendShopifyAddToCart } from './analytics-shopify';

type CartContextValue = {
  cart: Cart | null;
  count: number;
  drawerOpen: boolean;
  pending: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  addLine: (variantId: string, quantity?: number) => Promise<void>;
  updateLine: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  applyDiscount: (code: string) => Promise<{ ok: boolean; error?: string }>;
  removeDiscount: () => Promise<void>;
  changeVariant: (lineId: string, merchandiseId: string, quantity: number) => Promise<{ ok: boolean; error?: string }>;
  setNote: (note: string) => Promise<void>;
  setDeliveryDate: (date: string | null) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    readCart().then((c) => { if (!cancelled) setCart(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Attribution stitch: stamp the PostHog distinct_id on the cart as a
  // hidden note attribute so the order-paid webhook can capture
  // `order_completed` under the same PostHog person as the browsing
  // session (see setAnalyticsAttribution). Runs once per cart id per
  // mount; skipped when the cart already carries the current id, so
  // reloads don't generate redundant Storefront mutations.
  const attributionSyncedFor = useRef<string | null>(null);
  useEffect(() => {
    const cartId = cart?.id;
    if (!cartId || attributionSyncedFor.current === cartId) return;
    const existing = cart.attributes?.find((a) => a.key === POSTHOG_DISTINCT_ID_KEY)?.value;
    withPostHog((ph) => {
      const distinctId = ph.get_distinct_id?.();
      if (!distinctId) return;
      if (existing === distinctId) {
        attributionSyncedFor.current = cartId;
        return;
      }
      attributionSyncedFor.current = cartId;
      // Best-effort: no UI feedback, no cart state update needed (the
      // attribute is invisible to the shopper).
      void setAnalyticsAttribution(distinctId).catch(() => {});
    });
  }, [cart]);
  const [optimisticCount, setOptimisticCount] = useOptimistic(
    cart?.totalQuantity ?? 0,
    (state, delta: number) => Math.max(0, state + delta),
  );

  const addLine = useCallback(async (variantId: string, quantity = 1) => {
    startTransition(() => setOptimisticCount(quantity));
    setDrawerOpen(true);
    const res = await addAction(variantId, quantity);
    if (res.ok) {
      setCart(res.cart);
      // Look up the title from the post-add cart so the announcement
      // names what was added: "Added Tempur ProAdapt to your cart"
      // instead of generic "Added to your cart". Falls back to the
      // generic copy if the line can't be located (defensive — should
      // always be present right after a successful add).
      const addedLine = res.cart?.lines.nodes.find((l) => l.merchandise.id === variantId);
      const title = addedLine?.merchandise.product.title;
      // Funnel event — PLP/PDP → add_to_cart. Uses the post-add cart
      // line so the price and product handle reflect what Shopify
      // actually accepted (variant-level price, not the PDP min).
      if (addedLine) {
        const unitPrice = Number.parseFloat(addedLine.merchandise.price.amount) || 0;
        track('add_to_cart', {
          product_handle: addedLine.merchandise.product.handle,
          variant_id: addedLine.merchandise.id,
          product_title: title,
          quantity,
          price: unitPrice,
          currency: addedLine.merchandise.price.currencyCode,
        });
        // Mirror to Shopify's analytics so Admin's conversion funnel shows
        // the "Added to cart" stage (the PostHog/GA4 mirrors above don't
        // feed Shopify Admin). Production storefront only — the helper
        // self-gates on host. The cart gid keys the event to the session.
        if (res.cart) {
          sendShopifyAddToCart({
            cartId: res.cart.id,
            totalValue: unitPrice * quantity,
            product: {
              productGid: addedLine.merchandise.product.id,
              variantGid: addedLine.merchandise.id,
              name: addedLine.merchandise.product.title,
              brand: addedLine.merchandise.product.vendor,
              price: addedLine.merchandise.price.amount,
              quantity,
            },
          });
        }
      }
      announce(
        title
          ? quantity === 1
            ? `Added ${title} to your cart`
            : `Added ${quantity} of ${title} to your cart`
          : quantity === 1
            ? 'Added to your cart'
            : `${quantity} added to your cart`,
      );
    } else {
      announceAssertive('Could not add to cart. Please try again.');
    }
  }, [setOptimisticCount]);

  const updateLine = useCallback(async (lineId: string, quantity: number) => {
    const previousCart = cart;
    const line = previousCart?.lines.nodes.find((l) => l.id === lineId);
    const delta = line ? quantity - line.quantity : 0;
    startTransition(() => setOptimisticCount(delta));
    const res = await updateCartLine(lineId, quantity);
    if (res.ok) {
      setCart(res.cart);
      announce(`Cart updated. ${quantity} ${quantity === 1 ? 'item' : 'items'} of this product.`);
    } else {
      announceAssertive('Could not update cart.');
    }
  }, [cart, setOptimisticCount]);

  const removeLine = useCallback(async (lineId: string) => {
    const previousCart = cart;
    const line = previousCart?.lines.nodes.find((l) => l.id === lineId);
    const removedTitle = line?.merchandise.product.title;
    if (line) startTransition(() => setOptimisticCount(-line.quantity));
    const res = await removeCartLine(lineId);
    if (res.ok) {
      setCart(res.cart);
      announce(removedTitle ? `Removed ${removedTitle} from cart` : 'Removed from cart');
    } else {
      announceAssertive('Could not remove from cart.');
    }
  }, [cart, setOptimisticCount]);

  const applyDiscount = useCallback(async (code: string) => {
    const res = await applyDiscountCode(code);
    if (res.ok) {
      setCart(res.cart);
      announce('Discount applied.');
      return { ok: true };
    }
    announceAssertive(res.error);
    return { ok: false, error: res.error };
  }, []);

  const removeDiscount = useCallback(async () => {
    const res = await removeDiscountCode();
    if (res.ok) {
      setCart(res.cart);
      announce('Discount removed.');
    } else {
      announceAssertive('Could not remove discount.');
    }
  }, []);

  const changeVariant = useCallback(async (lineId: string, merchandiseId: string, quantity: number) => {
    const res = await changeLineVariant(lineId, merchandiseId, quantity);
    if (res.ok) {
      setCart(res.cart);
      announce('Option updated.');
      return { ok: true };
    }
    announceAssertive(res.error);
    return { ok: false, error: res.error };
  }, []);

  const setNote = useCallback(async (note: string) => {
    const res = await updateCartNote(note);
    if (res.ok) {
      setCart(res.cart);
      announce('Order note saved.');
    } else {
      announceAssertive('Could not save note.');
    }
  }, []);

  // No optimistic count change — the delivery date doesn't affect the
  // line total. The returned cart is authoritative (it echoes the saved
  // attributes), mirroring setNote's setCart-from-response pattern.
  const setDeliveryDate = useCallback(async (date: string | null) => {
    const res = await setDeliveryDateAction(date);
    if (res.ok) {
      setCart(res.cart);
      announce(date ? 'Delivery date saved.' : 'Delivery date cleared.');
    } else {
      announceAssertive(res.error || 'Could not save delivery date.');
    }
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    cart,
    count: optimisticCount,
    drawerOpen,
    pending,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    toggleDrawer: () => setDrawerOpen((v) => !v),
    addLine,
    updateLine,
    removeLine,
    applyDiscount,
    removeDiscount,
    changeVariant,
    setNote,
    setDeliveryDate,
  }), [cart, optimisticCount, drawerOpen, pending, addLine, updateLine, removeLine, applyDiscount, removeDiscount, changeVariant, setNote, setDeliveryDate]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
