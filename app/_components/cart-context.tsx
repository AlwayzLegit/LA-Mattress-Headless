'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useOptimistic, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import type { Cart } from '@/lib/shopify';
import { addToCart as addAction, updateCartLine, removeCartLine, readCart } from '@/app/_actions/cart';
import { announce } from './announcer';

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
      announce(quantity === 1 ? 'Added to your cart' : `${quantity} added to your cart`);
    } else {
      announce('Could not add to cart. Please try again.');
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
      announce('Could not update cart.');
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
      announce('Could not remove from cart.');
    }
  }, [cart, setOptimisticCount]);

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
  }), [cart, optimisticCount, drawerOpen, pending, addLine, updateLine, removeLine]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
