'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from './cart-context';
import { Icon } from './icon';
import { useBodyScrollLock } from './use-body-scroll-lock';
import { useFocusTrap } from './use-focus-trap';
import { formatMoney } from '@/lib/format';

export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, updateLine, removeLine, pending } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

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
    if (!drawerOpen) return;
    const id = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  const lines = cart?.lines.nodes ?? [];
  const isEmpty = lines.length === 0;

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
                        <div className="cart-qty">
                          <button
                            className="cart-qty-btn"
                            type="button"
                            onClick={() => updateLine(line.id, line.quantity - 1)}
                            disabled={pending}
                            aria-label="Decrease quantity"
                          >−</button>
                          <span className="tnum cart-qty-val">{line.quantity}</span>
                          <button
                            className="cart-qty-btn"
                            type="button"
                            onClick={() => updateLine(line.id, line.quantity + 1)}
                            disabled={pending}
                            aria-label="Increase quantity"
                          >+</button>
                        </div>
                        <span className="tnum cart-line-price">{formatMoney(line.cost.totalAmount)}</span>
                      </div>
                      <button
                        className="cart-line-remove"
                        type="button"
                        onClick={() => removeLine(line.id)}
                        disabled={pending}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="cart-drawer-ft">
              <div className="cart-shipping-strip" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 500, marginBottom: 'var(--s-3)' }}>
                <Icon name="truck" size={14} /> Free white-glove delivery applied.
              </div>
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
