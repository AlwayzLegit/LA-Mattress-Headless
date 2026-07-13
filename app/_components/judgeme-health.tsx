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
import { withPostHog } from '@/lib/ph';

// Long enough for slow mobile connections to finish the preloader →
// cache fetch → render chain; short enough to report while the visitor
// is still on the page.
const CHECK_DELAY_MS = 15_000;
const SESSION_FLAG = 'jdgm-health-reported';

// Revival pass schedule (Round 12). The judgeme-init <Script> is deduped
// by id across client-side navigations, so Judge.me's preloader only
// scans the DOM that existed at its FIRST execution. Any PDP reached by
// soft navigation — PLP card, related rail, recently-viewed — mounts a
// fresh widget div the preloader has never seen and the reviews section
// stays empty. That was the dominant source of judgeme_widget_failed
// (457 sessions / 30d, uniform across browsers — ruling out CSP or
// blocker causes, which never set __jdgmPreloaderLoaded in the first
// place). Before the 15s beacon gives up, nudge Judge.me to re-scan.
const RESCAN_DELAYS_MS = [1_500, 4_000, 8_000];

type JdgmWindow = typeof window & {
  __jdgmPreloaderLoaded?: boolean;
  jdgmLoadWidgets?: () => void;
  jdgm?: { init?: () => void };
};

function widgetHydrated(): boolean {
  const mount = document.querySelector('.jdgm-widget.jdgm-review-widget');
  // The legacy widget always renders SOMETHING once booted (header,
  // stars, Write-a-Review CTA — even for products with zero reviews),
  // so an empty mount means it hasn't hydrated.
  return Boolean(
    mount && (mount.children.length > 0 || (mount.textContent ?? '').trim().length > 0),
  );
}

/** Ask Judge.me to re-scan the DOM for un-hydrated widget mounts. */
function rescanJudgeme(w: JdgmWindow): void {
  // Preferred: the SPA hooks Judge.me exposes (which one exists depends
  // on preloader version/account widget generation).
  if (typeof w.jdgmLoadWidgets === 'function') {
    w.jdgmLoadWidgets();
    return;
  }
  if (typeof w.jdgm?.init === 'function') {
    w.jdgm.init();
    return;
  }
  // Last resort: re-execute the preloader with a fresh script element —
  // running it again re-triggers its DOM scan. Widgets it already set
  // up carry the `jdgm--done-setup-widget` marker and are skipped, so
  // this can't double-hydrate an existing widget.
  const old = document.getElementById('judgeme-preloader-js');
  if (old) old.remove();
  const s = document.createElement('script');
  s.id = 'judgeme-preloader-js';
  s.async = true;
  s.src = 'https://cdnwidget.judge.me/widget_preloader.js';
  s.onload = () => {
    (window as JdgmWindow).__jdgmPreloaderLoaded = true;
  };
  document.head.appendChild(s);
}

export function JudgemeHealthCheck({ productId }: { productId: string }) {
  // Revival: on each PDP mount, if the preloader is present but this
  // page's widget mount is still empty, re-scan on a short backoff.
  // Hard page loads hydrate on the preloader's own boot and never reach
  // the re-scan (widgetHydrated() is already true by the first check on
  // healthy loads; a re-scan on a still-loading healthy page is a
  // harmless no-op re-scan either way).
  useEffect(() => {
    const timers = RESCAN_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        const w = window as JdgmWindow;
        // Preloader never loaded → ad blocker / script block. Nothing
        // to revive; also outside the beacon's signal (see below).
        if (!w.__jdgmPreloaderLoaded) return;
        if (widgetHydrated()) return;
        rescanJudgeme(w);
      }, delay),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [productId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const w = window as JdgmWindow;
      // Preloader never loaded → ad blocker or script-level block;
      // not this beacon's signal (see docstring).
      if (!w.__jdgmPreloaderLoaded) return;

      // A dead boot that survived the revival passes above is a real
      // integration failure worth waking someone for.
      if (widgetHydrated()) return;

      try {
        if (sessionStorage.getItem(SESSION_FLAG)) return;
        sessionStorage.setItem(SESSION_FLAG, '1');
      } catch {
        /* sessionStorage unavailable (private mode) — report anyway */
      }

      Sentry.captureMessage('Judge.me widget failed to hydrate', {
        level: 'error',
        tags: { integration: 'judgeme' },
        extra: { productId, preloaderLoaded: true, rescanAttempted: true },
      });
      withPostHog((ph) => ph.capture('judgeme_widget_failed', { product_id: productId }));
    }, CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [productId]);

  return null;
}
