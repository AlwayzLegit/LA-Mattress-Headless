'use client';

/**
 * Real-user health beacon for the Judge.me reviews widget.
 *
 * Why this exists (2026-06-11 incident, fifth Judge.me breakage since
 * launch): the widget hydrates entirely client-side against Judge.me's
 * external services — CI has no browser and no network, so every
 * failure mode (wrong data attribute, account-side layout switches,
 * CSP blocks on fetch/eval, endpoint changes) ships green and is only
 * discovered when a human happens to browse a PDP. This component
 * closes that gap: ~15s after mount it checks whether the widget
 * actually hydrated and, if not, raises a Sentry error + PostHog event
 * from the real visitor's browser — detection in minutes instead of
 * days.
 *
 * Signal quality: the check only fires when the preloader script
 * demonstrably LOADED (`__jdgmPreloaderLoaded`, set by its onload in
 * judgeme-widget.tsx). Ad blockers — the dominant benign cause of a
 * missing widget — block the script itself, so they never reach the
 * report path. A loaded preloader followed by an empty widget means the
 * integration is genuinely broken (cache fetch failed, eval blocked,
 * account misconfigured, attribute contract changed). The CSP slice of
 * the not-even-loaded case is covered separately by the CSP report-uri
 * → Sentry wiring in next.config.mjs.
 *
 * Throttled to one report per browser session so a broken deploy emits
 * a clean volume signal rather than one event per PDP view.
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

// Long enough for slow mobile connections to finish the preloader →
// cache fetch → render chain; short enough to report while the visitor
// is still on the page.
const CHECK_DELAY_MS = 15_000;
const SESSION_FLAG = 'jdgm-health-reported';

export function JudgemeHealthCheck({ productId }: { productId: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const w = window as typeof window & { __jdgmPreloaderLoaded?: boolean };
      // Preloader never loaded → ad blocker or script-level block;
      // not this beacon's signal (see docstring).
      if (!w.__jdgmPreloaderLoaded) return;

      const mount = document.querySelector('.jdgm-widget.jdgm-review-widget');
      // The legacy widget always renders SOMETHING once booted (header,
      // stars, Write-a-Review CTA — even for products with zero
      // reviews), so an empty mount after the delay means a dead boot.
      const hydrated = Boolean(
        mount && (mount.children.length > 0 || (mount.textContent ?? '').trim().length > 0),
      );
      if (hydrated) return;

      try {
        if (sessionStorage.getItem(SESSION_FLAG)) return;
        sessionStorage.setItem(SESSION_FLAG, '1');
      } catch {
        /* sessionStorage unavailable (private mode) — report anyway */
      }

      Sentry.captureMessage('Judge.me widget failed to hydrate', {
        level: 'error',
        tags: { integration: 'judgeme' },
        extra: { productId, preloaderLoaded: true },
      });
      posthog.capture('judgeme_widget_failed', { product_id: productId });
    }, CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [productId]);

  return null;
}
