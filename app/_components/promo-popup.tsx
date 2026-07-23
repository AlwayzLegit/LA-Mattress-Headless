'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { NewsletterForm } from './newsletter-form';
import { useBodyScrollLock } from './use-body-scroll-lock';
import { useFocusTrap } from './use-focus-trap';
import { useCart } from './cart-context';
import { track } from '@/lib/analytics';
import { shouldSuppressPopup, markDismissed, markSignedUp } from '@/lib/promo-popup-state';

/**
 * Email-capture promo popup — "Get 20% off your first order of $499+"
 * (Round 13). Mounted sitewide in the storefront layout next to the chat
 * widget. Modeled on the search overlay's shell (portal + backdrop +
 * focus-trap + scroll-lock) and reuses the existing NewsletterForm
 * (source="popup") for the actual signup, so this component only owns the
 * modal chrome, the trigger timing, and the post-signup code reveal.
 *
 * Flow:
 *  - Suppressed on /admin, /account, /checkout, and once the visitor has
 *    signed up (1yr) or dismissed it (30d) — see lib/promo-popup-state.
 *  - Otherwise opens after an 8s dwell OR on desktop exit-intent
 *    (cursor leaving through the top of the viewport), whichever first.
 *  - On a successful signup the body swaps to a code-reveal view: it
 *    shows WELCOME20, auto-applies it to the cart (best-effort), and
 *    offers a copy button. The customer keeps the code either way.
 *
 * The discount itself (20% off, $499 minimum subtotal, one use per
 * customer) lives in Shopify Admin → Discounts as code WELCOME20; this
 * component only references the code string.
 */

const PROMO_CODE = 'WELCOME20';
const OPEN_DELAY_MS = 8000;
const SUPPRESSED_PREFIXES = ['/admin', '/account', '/checkout'];

type ApplyState = 'idle' | 'applying' | 'applied' | 'failed';

export function PromoPopup() {
  const pathname = usePathname();
  const { applyDiscount } = useCart();
  const [open, setOpen] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const [applyState, setApplyState] = useState<ApplyState>('idle');
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);
  const headingId = useId();
  const bodyId = useId();

  const suppressedRoute = SUPPRESSED_PREFIXES.some((p) => pathname?.startsWith(p));

  useBodyScrollLock(open);
  useFocusTrap(open, panelRef);

  // Arm the open triggers once per eligible page. Re-checks the durable
  // suppression flags at arm time (not just render) so a signed-up /
  // dismissed visitor never even schedules the timer.
  useEffect(() => {
    if (openedRef.current || suppressedRoute) return;
    if (shouldSuppressPopup()) return;

    const openNow = () => {
      if (openedRef.current) return;
      openedRef.current = true;
      window.clearTimeout(timer);
      document.removeEventListener('mouseout', onMouseOut);
      setOpen(true);
      track('promo_popup', { action: 'shown' });
    };
    // Exit-intent: the cursor leaves through the top edge (toward the
    // tab bar / close button). relatedTarget null = left the document.
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && e.relatedTarget === null) openNow();
    };

    const timer = window.setTimeout(openNow, OPEN_DELAY_MS);
    document.addEventListener('mouseout', onMouseOut);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, [suppressedRoute]);

  const dismiss = useCallback(
    (reason: 'button' | 'backdrop' | 'escape') => {
      setOpen(false);
      // Only a close BEFORE signup is a dismissal; post-signup close is a
      // normal exit (already marked signed-up, converted already tracked).
      if (!signedUp) {
        markDismissed();
        track('promo_popup', { action: 'dismissed', reason });
      }
    },
    [signedUp],
  );

  // Move focus into the dialog when it opens, and again when the body
  // swaps to the code-reveal (the email input it was on unmounts). The
  // focus trap keeps focus contained after this; on close it restores
  // focus to wherever the visitor was.
  useLayoutEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open, signedUp]);

  // Escape to close while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss('escape');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  const onSignupSuccess = useCallback(async () => {
    setSignedUp(true);
    markSignedUp();
    track('promo_popup', { action: 'converted' });
    setApplyState('applying');
    try {
      const res = await applyDiscount(PROMO_CODE);
      setApplyState(res.ok ? 'applied' : 'failed');
    } catch {
      setApplyState('failed');
    }
  }, [applyDiscount]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is visible to copy manually */
    }
  }, []);

  if (!open) return null;

  return createPortal(
    <div
      className="promo-popup-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss('backdrop');
      }}
    >
      <div
        className="promo-popup-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        tabIndex={-1}
        ref={panelRef}
      >
        <button
          type="button"
          className="promo-popup-close"
          onClick={() => dismiss('button')}
          aria-label="Close"
        >
          <Icon name="close" size={18} />
        </button>

        {signedUp ? (
          <div className="promo-popup-body promo-popup-done">
            <div className="promo-popup-check" aria-hidden="true">
              <Icon name="check" size={28} />
            </div>
            <h2 id={headingId} className="promo-popup-heading">You&rsquo;re in!</h2>
            <p id={bodyId} className="promo-popup-sub">
              Here&rsquo;s <strong>20% off</strong> your first order of $499 or more.
              Use this code at checkout:
            </p>
            <div className="promo-popup-code-row">
              <code className="promo-popup-code">{PROMO_CODE}</code>
              <button type="button" className="btn btn-secondary promo-popup-copy" onClick={copyCode}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="promo-popup-apply-note" role="status" aria-live="polite">
              {applyState === 'applying'
                ? 'Adding it to your cart…'
                : applyState === 'applied'
                  ? 'Applied to your cart, 20% comes off at checkout on orders $499+.'
                  : 'Enter it at checkout to take 20% off orders $499+.'}
            </p>
            <Link
              href="/collections/mattresses"
              className="btn btn-primary promo-popup-cta"
              onClick={() => setOpen(false)}
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="promo-popup-body">
            <div className="eyebrow promo-popup-eyebrow">Members save</div>
            <h2 id={headingId} className="promo-popup-heading">
              Get 20% off your first order
            </h2>
            <p id={bodyId} className="promo-popup-sub">
              On any mattress order of <strong>$499 or more</strong>. Join our email
              list and we&rsquo;ll send your code, then apply it to your cart instantly.
            </p>
            <NewsletterForm source="popup" onSuccess={onSignupSuccess} />
            <p className="promo-popup-fine">
              *Valid on your first order of $499+. One use per customer. Cannot be
              combined with other offers. By subscribing you agree to receive marketing
              emails; unsubscribe anytime. See our{' '}
              <Link href="/pages/privacy-policy" className="promo-popup-fine-link">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
