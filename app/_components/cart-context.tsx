'use client';

import { createContext, useCallback, useContext, useMemo, useOptimistic, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import type { Cart } from '@/lib/shopify';
import { addToCart as addAction, updateCartLine, removeCartLine } from '@/app/_actions/cart';

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

export function CartProvider({ initialCart, children }: { initialCart: Cart | null; children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(initialCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [optimisticCount, setOptimisticCount] = useOptimistic(
    cart?.totalQuantity ?? 0,
    (state, delta: number) => Math.max(0, state + delta),
  );

  const addLine = useCallback(async (variantId: string, quantity = 1) => {
    startTransition(() => setOptimisticCount(quantity));
    setDrawerOpen(true);
    const res = await addAction(variantId, quantity);
    if (res.ok) setCart(res.cart);
  }, [setOptimisticCount]);

  const updateLine = useCallback(async (lineId: string, quantity: number) => {
    const previousCart = cart;
    const line = previousCart?.lines.nodes.find((l) => l.id === lineId);
    const delta = line ? quantity - line.quantity : 0;
    startTransition(() => setOptimisticCount(delta));
    const res = await updateCartLine(lineId, quantity);
    if (res.ok) setCart(res.cart);
  }, [cart, setOptimisticCount]);

  const removeLine = useCallback(async (lineId: string) => {
    const previousCart = cart;
    const line = previousCart?.lines.nodes.find((l) => l.id === lineId);
    if (line) startTransition(() => setOptimisticCount(-line.quantity));
    const res = await removeCartLine(lineId);
    if (res.ok) setCart(res.cart);
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
