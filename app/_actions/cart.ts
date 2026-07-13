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
  cartAttributesUpdate,
  getCart,
  getProductByHandle,
} from '@/lib/shopify';
import type { Cart, CartLineInput, ProductOption, ProductVariant } from '@/lib/shopify';
import { DELIVERY_DATE_KEY, POSTHOG_DISTINCT_ID_KEY } from '@/lib/cart-attributes';

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


/**
 * Map an action failure to shopper-safe copy (audit
 * codeq-action-error-leak-12). Raw upstream messages (Storefront API
 * bodies, AbortError timeouts) read as backend jargon in cart toasts
 * and can disclose internals; Shopify UserError validation messages
 * ("Discount code is invalid") are written for shoppers and pass
 * through. Same split the chat widget's friendlyChatError uses.
 */
function friendlyCartError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    console.error('[cart-action]', err);
    // Shopify checkout/cart UserErrors are surfaced as plain Errors with
    // shopper-facing text and no API markers — keep those.
    const m = err.message;
    const looksInternal = /shopify|graphql|fetch|network|abort|timeout|5\d\d|json|unexpected token/i.test(m) || m.length > 140;
    if (!looksInternal) return m;
  }
  return `${fallback} — please try again, or call (800) 218-3578 and we'll sort it out.`;
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
    return { ok: false, error: friendlyCartError(err, 'Add to cart failed') };
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
    return { ok: false, error: friendlyCartError(err, 'Update failed') };
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
    return { ok: false, error: friendlyCartError(err, 'Remove failed') };
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
    return { ok: false, error: friendlyCartError(err, 'Could not apply code') };
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
    return { ok: false, error: friendlyCartError(err, 'Could not remove code') };
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
    return { ok: false, error: friendlyCartError(err, 'Could not change option') };
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
    return { ok: false, error: friendlyCartError(err, 'Could not save note') };
  }
}

/**
 * Validates a `YYYY-MM-DD` string is a real calendar date no earlier
 * than today and within ~3 months. The window is intentionally looser
 * than the client picker's (tomorrow … +60d) so a valid client choice
 * is never rejected by a timezone boundary. All comparisons are in UTC.
 */
function isValidDeliveryDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return false;
  }
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const max = today + 90 * 86_400_000;
  return dt.getTime() >= today && dt.getTime() <= max;
}

/**
 * Saves (or clears, when `date` is null) the requested delivery date as
 * a cart attribute. Non-delivery attributes are preserved — the call to
 * Shopify is a full replace.
 */
export async function setDeliveryDate(date: string | null): Promise<ActionResult> {
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return { ok: false, error: 'No cart' };
  if (date && !isValidDeliveryDate(date)) {
    return { ok: false, error: 'Please choose a valid delivery date.' };
  }
  try {
    const current = await getCart(cartId);
    if (!current) return { ok: false, error: 'No cart' };
    const others = current.attributes.filter((a) => a.key !== DELIVERY_DATE_KEY);
    const next = date ? [...others, { key: DELIVERY_DATE_KEY, value: date }] : others;
    const cart = await cartAttributesUpdate(cartId, next);
    revalidatePath('/cart');
    return { ok: true, cart };
  } catch (err) {
    return { ok: false, error: friendlyCartError(err, 'Could not save delivery date') };
  }
}

/**
 * Stamps the shopper's PostHog distinct_id on the cart as a hidden note
 * attribute so the order-paid webhook can attribute `order_completed`
 * to the same PostHog person as the browsing session (the funnel /
 * quiz→purchase / chat→purchase panels on /admin all depend on this
 * join). Fired by CartProvider once per cart; failures are silent —
 * attribution is best-effort and must never disturb the cart UX.
 *
 * PostHog distinct_ids are UUIDs for anonymous visitors but can be
 * arbitrary strings after identify(); the guard caps length and
 * charset so junk can't be written into order note attributes.
 */
export async function setAnalyticsAttribution(distinctId: string): Promise<{ ok: boolean }> {
  const id = (distinctId ?? '').trim();
  if (!id || id.length > 200 || !/^[\w.:@+-]+$/.test(id)) return { ok: false };
  const cartId = (await cookies()).get(COOKIE)?.value;
  if (!cartId) return { ok: false };
  try {
    const current = await getCart(cartId);
    if (!current) return { ok: false };
    const existing = current.attributes.find((a) => a.key === POSTHOG_DISTINCT_ID_KEY)?.value;
    if (existing === id) return { ok: true };
    const others = current.attributes.filter((a) => a.key !== POSTHOG_DISTINCT_ID_KEY);
    await cartAttributesUpdate(cartId, [...others, { key: POSTHOG_DISTINCT_ID_KEY, value: id }]);
    return { ok: true };
  } catch {
    return { ok: false };
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
