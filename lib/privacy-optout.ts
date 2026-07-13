'use client';

/**
 * CCPA/CPRA sale-and-share opt-out state (Round 13, 2026 CCPA regs).
 *
 * Two signals, either of which opts this browser out:
 *
 *  1. Global Privacy Control — `navigator.globalPrivacyControl`, set by
 *     the browser or a privacy extension. The regulations effective
 *     2026-01-01 require businesses to treat it as a valid opt-out of
 *     sale/share AND to display that the signal was honored (the
 *     status banner on /pages/data-sharing-opt-out does the display).
 *
 *  2. A first-party stored opt-out, set by the one-click button on the
 *     privacy-choices page. The regs' symmetry rule means the pure
 *     sale/share opt-out may not demand more effort than opting back
 *     in — so it's a single click with no form or verification
 *     (verification is only permitted for access/delete/correct
 *     requests, which keep the form).
 *
 * Effect: `analytics-ga4.tsx` skips loading Google Analytics entirely
 * for opted-out browsers — the only third-party tag on the site that
 * could plausibly constitute "sharing" under the CCPA's cross-context
 * behavioral advertising definition. PostHog and Sentry operate as
 * service providers (first-party analytics/error monitoring under
 * contract) and are outside the sale/share opt-out's scope.
 *
 * The cookie (not just localStorage) is deliberate: it survives
 * localStorage clears less often than the reverse, and having both
 * makes the opt-out as durable as we can make a browser-scoped signal.
 */

const COOKIE_NAME = 'lam_ccpa_optout';
const STORAGE_KEY = 'lam-ccpa-optout';
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

export function hasGpcSignal(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function hasStoredOptOut(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === '1') return true;
  } catch {
    /* private mode — cookie check below still applies */
  }
  return document.cookie.split('; ').some((c) => c === `${COOKIE_NAME}=1`);
}

/** True when this browser is opted out of sale/share by ANY signal. */
export function isOptedOut(): boolean {
  return hasGpcSignal() || hasStoredOptOut();
}

export function setStoredOptOut(on: boolean): void {
  if (typeof document === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — cookie below is the fallback */
  }
  document.cookie = on
    ? `${COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE_S}; SameSite=Lax`
    : `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
