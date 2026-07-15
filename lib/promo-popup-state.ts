'use client';

/**
 * Promo-popup suppression state (Round 13 — email-capture "20% off your
 * first order of $499+" modal, promo-popup.tsx).
 *
 * The popup should appear at most once for a visitor who engages with it,
 * and never again once they've either signed up or dismissed it. Two
 * independent flags, EITHER of which suppresses the popup:
 *
 *  1. signed-up — set after a successful newsletter signup through the
 *     popup. Long-lived (1 year): once they have the code, don't nag.
 *  2. dismissed — set when they close the popup without signing up
 *     (X / backdrop / Escape). Shorter-lived (30 days) so a visitor who
 *     wasn't ready on one visit can be re-offered later.
 *
 * Same durability pattern as lib/privacy-optout.ts: write both a cookie
 * and localStorage so the signal survives a clear of either one, and
 * SSR-guard every `document`/`window` access (the popup is a client
 * component but is statically imported into the server layout, so this
 * module can be evaluated during render).
 */

const SIGNUP_COOKIE = 'lam_promo_signup';
const SIGNUP_STORAGE = 'lam-promo-signup';
const DISMISS_COOKIE = 'lam_promo_dismissed';
const DISMISS_STORAGE = 'lam-promo-dismissed';

const YEAR_S = 60 * 60 * 24 * 365;
const THIRTY_DAYS_S = 60 * 60 * 24 * 30;

function readFlag(storageKey: string, cookieName: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    if (window.localStorage.getItem(storageKey) === '1') return true;
  } catch {
    /* private mode — cookie check below still applies */
  }
  return document.cookie.split('; ').some((c) => c === `${cookieName}=1`);
}

function writeFlag(storageKey: string, cookieName: string, maxAgeS: number): void {
  if (typeof document === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    /* private mode — cookie below is the fallback */
  }
  document.cookie = `${cookieName}=1; path=/; max-age=${maxAgeS}; SameSite=Lax`;
}

/** True when the popup should NOT be shown (already signed up or dismissed). */
export function shouldSuppressPopup(): boolean {
  return (
    readFlag(SIGNUP_STORAGE, SIGNUP_COOKIE) ||
    readFlag(DISMISS_STORAGE, DISMISS_COOKIE)
  );
}

/** Record a successful popup signup — suppress for a year. */
export function markSignedUp(): void {
  writeFlag(SIGNUP_STORAGE, SIGNUP_COOKIE, YEAR_S);
}

/** Record a dismissal without signup — suppress for 30 days. */
export function markDismissed(): void {
  writeFlag(DISMISS_STORAGE, DISMISS_COOKIE, THIRTY_DAYS_S);
}
