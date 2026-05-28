'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from './cart-context';
import { Icon } from './icon';
import { useBodyScrollLock } from './use-body-scroll-lock';
import { useFocusTrap } from './use-focus-trap';
import { CartEmptyRecent } from './cart-empty-recent';
import { announce } from './announcer';
import { formatMoney } from '@/lib/format';
import { FreeShippingBar } from '@/app/(storefront)/cart/free-shipping-bar';
import { track } from '@/lib/analytics';
import { CartPromoCode } from './cart-promo-code';
import { PdpDeliveryCutoff } from './pdp-delivery-cutoff';

export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, updateLine, removeLine, pending } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // Phase 219: belt-and-braces focus restore on close. `useFocusTrap`
  // is supposed to restore focus to the activator when its `active`
  // flag flips false, but the Cowork pre-launch audit caught focus
  // dropping to BODY after Esc on the cart drawer. Rather than dig
  // into a timing race we can't reproduce in CI, capture the trigger
  // synchronously on open and focus it back on close.
  const triggerRef = useRef<HTMLElement | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  // Stack-aware body scroll lock — see use-body-scroll-lock.ts. Other
  // overlays (search, filter shell, mobile nav) share the same hook.
  useBodyScrollLock(drawerOpen);

  // Tab cycles within the drawer; close restores focus to the cart
  // icon button (or wherever was focused at open time).
  useFocusTrap(drawerOpen, drawerRef);

  // Auto-focus the close button on open. Lands keyboard / SR users
  // somewhere predictable. Wrapped in rAF so the drawer is in the
  // DOM and not stuck in mid-transition before .focus() runs.
  useEffect(() => {
    if (drawerOpen) {
      // Capture the element that had focus right before open — almost
      // always the trigger that fired addLine() (PDP ATC button, cart
      // icon in nav, etc.). Stored synchronously so we can restore
      // even if the trigger is on a different document subtree from
      // the drawer.
      triggerRef.current = document.activeElement as HTMLElement | null;
      // Announce the open transition with the current item count so
      // screen-reader users hear what just happened (the visual slide-in
      // and focus shift to the close button is otherwise silent for AT).
      // Read totalQuantity inline rather than as a hook dep so the effect
      // doesn't re-fire (and re-announce) on every cart mutation.
      const qty = cart?.totalQuantity ?? 0;
      announce(`Shopping cart opened. ${qty} item${qty === 1 ? '' : 's'}.`);
      const id = requestAnimationFrame(() => closeBtnRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    // drawerOpen flipped false — restore focus to the captured trigger
    // if it's still in the DOM. `triggerRef.current?.focus()` is a no-op
    // when the trigger has been unmounted (e.g. user navigated mid-
    // session), which is the desired graceful behaviour.
    const target = triggerRef.current;
    triggerRef.current = null;
    if (target && document.contains(target)) {
      // rAF so we run after React has finished unmounting the dialog
      // and removing it from the focus tree — focusing during unmount
      // can race with the browser's own focus fallback to BODY.
      requestAnimationFrame(() => target.focus());
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  const lines = cart?.lines.nodes ?? [];
  const isEmpty = lines.length === 0;

  // Cross-sell heuristic: when the cart has a mattress and no
  // protector/cover/sheet/encasement, surface a one-line nudge to add
  // a mattress protector. Title-based detection (the cart-line product
  // shape doesn't include productType) — broad enough to catch all
  // mattress lines, narrow enough that "protector" / "encasement" /
  // "sheet" suppress the prompt for shoppers already covered.
  const hasMattress = lines.some((l) => /mattress/i.test(l.merchandise.product.title));
  const hasProtector = lines.some((l) =>
    /protector|cover|encasement|sheet/i.test(l.merchandise.product.title),
  );
  const showProtectorNudge = hasMattress && !hasProtector;

  return (
    <div className="cart-drawer-root" role="dialog" aria-label="Shopping cart" aria-modal="true" ref={drawerRef}>
      <button className="cart-drawer-scrim" type="button" onClick={closeDrawer} aria-label="Close cart" />
      <aside className="cart-drawer">
        <header className="cart-drawer-hd">
          <div>
            <div className="eyebrow">Your cart</div>
            <h2 className="h3" style={{ margin: '4px 0 0' }}>
              {cart?.totalQuantity ?? 0} item{(cart?.totalQuantity ?? 0) === 1 ? '' : 's'}
            </h2>
          </div>
          <button ref={closeBtnRef} className="icon-btn" type="button" onClick={closeDrawer} aria-label="Close">
            <Icon name="close" size={22} />
          </button>
        </header>

        {isEmpty ? (
          <div className="cart-drawer-empty">
            <Icon name="cart" size={32} />
            <p className="muted" style={{ marginTop: 'var(--s-3)' }}>Your cart is empty.</p>
            <Link href="/collections/mattresses" className="btn btn-primary" onClick={closeDrawer} style={{ marginTop: 'var(--s-4)' }}>
              Shop mattresses
            </Link>
            <CartEmptyRecent onNavigate={closeDrawer} />
          </div>
        ) : (
          <>
            <ul className="cart-line-list" aria-busy={pending}>
              {lines.map((line) => {
                const v = line.merchandise;
                return (
                  <li key={line.id} className="cart-line">
                    <Link href={`/products/${v.product.handle}`} onClick={closeDrawer} className="cart-line-img">
                      {v.product.featuredImage ? (
                        <Image
                          src={v.product.featuredImage.url}
                          alt={v.product.featuredImage.altText ?? v.product.title}
                          width={120}
                          height={120}
                          sizes="120px"
                          loading="lazy"
                          style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                        />
                      ) : (
                        <div className="ph" style={{ width: '100%', height: '100%' }} />
                      )}
                    </Link>
                    <div className="cart-line-meta">
                      <Link href={`/products/${v.product.handle}`} onClick={closeDrawer} className="cart-line-title">
                        {v.product.title}
                      </Link>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {v.selectedOptions.map((o) => `${o.name}: ${o.value}`).join(' · ')}
                      </div>
                      <div className="cart-line-row">
                        <div className="cart-qty" role="group" aria-label={`Quantity for ${v.product.title}`}>
                          <button
                            className="cart-qty-btn"
                            type="button"
                            onClick={() => updateLine(line.id, line.quantity - 1)}
                            disabled={pending}
                            aria-label={`Decrease quantity of ${v.product.title}`}
                          >−</button>
                          <span className="tnum cart-qty-val" aria-live="polite" aria-label={`${line.quantity} in cart`}>
                            {line.quantity}
                          </span>
                          <button
                            className="cart-qty-btn"
                            type="button"
                            onClick={() => updateLine(line.id, line.quantity + 1)}
                            disabled={pending}
                            aria-label={`Increase quantity of ${v.product.title}`}
                          >+</button>
                        </div>
                        <span className="tnum cart-line-price">{formatMoney(line.cost.totalAmount)}</span>
                      </div>
                      <button
                        className="cart-line-remove"
                        type="button"
                        onClick={() => removeLine(line.id)}
                        disabled={pending}
                        aria-label={`Remove ${v.product.title} from cart`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Cross-sell nudge: "Protect your investment". Renders
                only when the cart has a mattress and no
                protector/cover/sheet — direct conversion + warranty
                preservation hint (stains void the 120-night
                exchange). Single line, link to the protector
                collection; not a card strip so it doesn't compete
                with the line list visually. */}
            {showProtectorNudge ? (
              <Link
                href="/collections/mattress-protector"
                onClick={closeDrawer}
                className="cart-protector-nudge"
              >
                <Icon name="shield" size={16} />
                <span>
                  <strong>Protect your investment.</strong> A mattress protector keeps your 120-night exchange intact — stains void it.
                </span>
                <Icon name="arrow-right" size={14} />
              </Link>
            ) : null}

            <footer className="cart-drawer-ft">
              {/* Live same-day-delivery cutoff. Same component as the
                  PDP rail so the urgency hint is consistent across
                  the funnel. */}
              <PdpDeliveryCutoff />
              {cart ? <FreeShippingBar subtotal={cart.cost.subtotalAmount} /> : null}
              {/* Promo-code expander. Closes the abandonment leak
                  where shoppers leave to Google "LA Mattress discount
                  code" because the field used to only exist at
                  Shopify-hosted checkout. */}
              <CartPromoCode />
              <div className="cart-summary-row">
                <span className="muted">Subtotal</span>
                <span className="tnum cart-subtotal">
                  {cart ? formatMoney(cart.cost.subtotalAmount) : '—'}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Tax &amp; shipping calculated at checkout.
              </p>
              <a
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 'var(--s-3)' }}
                href={cart?.checkoutUrl ?? '/cart'}
                onClick={() => {
                  // Last first-party event before Shopify hosts the
                  // checkout flow — pairs with order_completed (driven
                  // by a Shopify webhook → posthog-node) to close the
                  // funnel.
                  if (cart) {
                    track('checkout_started', {
                      item_count: cart.totalQuantity,
                      cart_value: Number.parseFloat(cart.cost.subtotalAmount.amount) || 0,
                      currency: cart.cost.subtotalAmount.currencyCode,
                    });
                  }
                }}
              >
                Checkout <Icon name="arrow-right" size={16} />
              </a>
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="link-arrow"
                style={{ marginTop: 'var(--s-3)', justifyContent: 'center', width: '100%' }}
              >
                View full cart <Icon name="arrow-right" size={14} />
              </Link>
              <ul className="pdp-trust" style={{ marginTop: 'var(--s-4)', borderTop: '1px solid var(--line)', paddingTop: 'var(--s-3)', fontSize: 12 }}>
                <li><Icon name="lock" size={14} /> Secure checkout</li>
                <li><Icon name="shield" size={14} /> 120-night exchange</li>
              </ul>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
