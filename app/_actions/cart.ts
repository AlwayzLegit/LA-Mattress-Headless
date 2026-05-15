'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  cartCreate,
  cartLinesAdd,
  cartLinesUpdate,
  cartLinesRemove,
  cartDiscountCodesUpdate,
  cartNoteUpdate,
  getCart,
  getProductByHandle,
} from '@/lib/shopify';
import type { Cart, CartLineInput, ProductOption, ProductVariant } from '@/lib/shopify';

const COOKIE = 'cartId';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

async function setCartCookie(cartId: string) {
  (await cookies()).set(COOKIE, cartId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

async function clearCartCookie() {
  (await cookies()).delete(COOKIE);
}

export async function readCart(): Promise<Cart | null> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return null;
  try {
    const cart = await getCart(cartId);
    if (!cart) await clearCartCookie();
    return cart;
  } catch {
    return null;
  }
}

async function ensureCart(initialLines?: CartLineInput[]): Promise<Cart> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (cartId) {
    const existing = await getCart(cartId).catch(() => null);
    if (existing) return existing;
  }
  const fresh = await cartCreate(initialLines);
  await setCartCookie(fresh.id);
  return fresh;
}

export type ActionResult = { ok: true; cart: Cart } | { ok: false; error: string };

export async function addToCart(merchandiseId: string, quantity = 1): Promise<ActionResult> {
  if (!merchandiseId) return { ok: false, error: 'Missing variant id' };
  try {
    const existingId = (await cookies()).get(COOKIE)?.value;
    let cart: Cart;
    if (existingId) {
      const existing = await getCart(existingId).catch(() => null);
      if (existing) {
        cart = await cartLinesAdd(existing.id, [{ merchandiseId, quantity }]);
      } else {
        cart = await ensureCart([{ merchandiseId, quantity }]);
      }
    } else {
      cart = await ensureCart([{ merchandiseId, quantity }]);
    }
    revalidatePath('/cart');
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Add to cart failed' };
  }
}

export async function updateCartLine(lineId: string, quantity: number): Promise<ActionResult> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return { ok: false, error: 'No cart' };
  try {
    const cart =
      quantity <= 0
        ? await cartLinesRemove(cartId, [lineId])
        : await cartLinesUpdate(cartId, [{ id: lineId, quantity }]);
    revalidatePath('/cart');
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Update failed' };
  }
}

export async function removeCartLine(lineId: string): Promise<ActionResult> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return { ok: false, error: 'No cart' };
  try {
    const cart = await cartLinesRemove(cartId, [lineId]);
    revalidatePath('/cart');
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Remove failed' };
  }
}

export async function applyDiscountCode(code: string): Promise<ActionResult> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return { ok: false, error: 'No cart' };
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: 'Enter a code' };
  try {
    const cart = await cartDiscountCodesUpdate(cartId, [trimmed]);
    // Storefront returns empty userErrors for an invalid code — it just
    // marks it inapplicable. Verify the code actually took.
    const applied = cart.discountCodes.some(
      (d) => d.applicable && d.code.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!applied) {
      return { ok: false, error: "That code isn't valid for the items in your cart." };
    }
    revalidatePath('/cart');
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not apply code' };
  }
}

export async function removeDiscountCode(): Promise<ActionResult> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return { ok: false, error: 'No cart' };
  try {
    const cart = await cartDiscountCodesUpdate(cartId, []);
    revalidatePath('/cart');
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not remove code' };
  }
}

export async function changeLineVariant(
  lineId: string,
  merchandiseId: string,
  quantity: number,
): Promise<ActionResult> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return { ok: false, error: 'No cart' };
  if (!merchandiseId) return { ok: false, error: 'Missing variant' };
  try {
    const cart = await cartLinesUpdate(cartId, [{ id: lineId, quantity, merchandiseId }]);
    revalidatePath('/cart');
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not change option' };
  }
}

export async function updateCartNote(note: string): Promise<ActionResult> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return { ok: false, error: 'No cart' };
  try {
    const cart = await cartNoteUpdate(cartId, note);
    revalidatePath('/cart');
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save note' };
  }
}

/**
 * Lazy-fetch the option matrix for a cart line's product so the in-cart
 * variant editor can offer a swap WITHOUT bloating every cart read with
 * full product options/variants. Returns null on any failure (the
 * editor just hides the "change" affordance).
 */
export async function getLineSwapOptions(
  handle: string,
): Promise<{ options: ProductOption[]; variants: ProductVariant[] } | null> {
  try {
    const product = await getProductByHandle(handle);
    if (!product) return null;
    return { options: product.options, variants: product.variants };
  } catch {
    return null;
  }
}
