'use client';

import { useEffect } from 'react';

/**
 * Loads Judge.me's preloader script when the user is about to need it.
 *
 * Why this exists (regression report 2026-05-29): both "Write a review"
 * and "Load more" stopped working on live PDPs. The previous impl used
 * `<Script strategy="lazyOnload">`, which Next.js implements as
 * `requestIdleCallback` AFTER the `window.load` event fires. On a real
 * PDP the load event waits for every queued resource (PostHog
 * autocapture, GA4, Shopify metafield fetches, related-product
 * thumbnails, etc.) and the idle callback then waits for a quiet
 * frame — on heavy mobile sessions that quiet frame never arrives, so
 * the Judge.me preloader script is never injected, the widget never
 * hydrates, `.jdgm-write-rev-link` is never bound to the form-open
 * handler, and the pagination links inside the (never-rendered) widget
 * never exist in the first place. Symptom on the user side: server-
 * rendered "Write a review" anchor just scrolls to its `#mount` target,
 * and "Load more" either doesn't exist or appears (from a bfcache
 * restore) but does nothing.
 *
 * Fix: inject the scripts ourselves under two triggers, whichever
 * fires first:
 *   1. IntersectionObserver on the widget mount with 800px rootMargin —
 *      starts loading the moment the user scrolls anywhere near the
 *      reviews section, so the widget is hydrated by the time they
 *      reach it.
 *   2. Click on `.jdgm-write-rev-link` (capture phase) — for users who
 *      scroll fast and tap the Write-a-Review CTA before the observer
 *      trigger has loaded the script. The first click loads + queues a
 *      synthetic re-click against the now-hydrated handler so the form
 *      opens without requiring a second tap. Capture phase so we run
 *      before Judge.me's own bubble-phase listeners.
 *
 * Why not `strategy="afterInteractive"`: would also fix the bug, but
 * forces the ~80KB preloader fetch on every PDP load regardless of
 * whether the user scrolls to reviews. Phase 257 measured that as a
 * 80–150ms TBT regression and the corresponding INP-band drop on
 * mobile. The intersection trigger preserves the perf benefit while
 * making the load actually reliable.
 *
 * Why not native dynamic `import()`: Judge.me's preloader is a global
 * UMD script that expects to find `window.jdgm` already configured and
 * scans the DOM on execution. Treating it as an ES module would break
 * its assumptions. Injecting `<script>` tags into the document head
 * matches what `<Script>` was doing, just on a trigger we control.
 *
 * The config (SHOP_DOMAIN, PLATFORM, PUBLIC_TOKEN) is public-by-design
 * — it appears in the rendered HTML of every Judge.me install — so
 * hardcoding here is fine.
 */
const JUDGEME_WIDGET_TOKEN = '9MsdQpWBCXmPK-berSnU7a6TUPs';
const JUDGEME_SHOP_DOMAIN = 'la-mattress.myshopify.com';
const PRELOADER_SRC = 'https://cdnwidget.judge.me/widget_preloader.js';

declare global {
  interface Window {
    jdgm?: {
      SHOP_DOMAIN?: string;
      PLATFORM?: string;
      PUBLIC_TOKEN?: string;
      [k: string]: unknown;
    };
  }
}

export function JudgemeWidgetLoader() {
  useEffect(() => {
    let loaded = false;

    function loadPreloader() {
      if (loaded) return;
      loaded = true;

      // 1. Configure the global the preloader will read on execute.
      //    Setting on window is idempotent — re-running just overwrites
      //    with the same values.
      window.jdgm = window.jdgm || {};
      window.jdgm.SHOP_DOMAIN = JUDGEME_SHOP_DOMAIN;
      window.jdgm.PLATFORM = 'shopify';
      window.jdgm.PUBLIC_TOKEN = JUDGEME_WIDGET_TOKEN;

      // 2. Inject the preloader. We check for an existing tag with the
      //    same src so a stray double-call (e.g. observer fires and a
      //    click fires within the same tick) doesn't pull the script
      //    twice. The script self-bootstraps once it executes.
      const existing = document.querySelector(
        `script[src="${PRELOADER_SRC}"]`
      );
      if (existing) return;

      const s = document.createElement('script');
      s.src = PRELOADER_SRC;
      s.async = true;
      document.head.appendChild(s);
    }

    // Trigger 1: IntersectionObserver on the widget mount.
    //
    // We watch the mount placeholder rather than this loader component
    // because the mount is what actually needs to be hydrated — when it
    // approaches viewport, that's when we want the script in flight so
    // it has time to fetch, parse, and hydrate before the user gets
    // there. 800px rootMargin gives roughly one viewport-height of
    // headroom on mobile (PDP buy-box height ≈ 600–900px) and ~half
    // that on desktop, which is enough warmup time on a 4G connection
    // for the script to finish before the user scrolls in.
    const mount = document.getElementById('judgeme-widget-mount');
    let observer: IntersectionObserver | null = null;
    if (mount && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              loadPreloader();
              observer?.disconnect();
              observer = null;
              break;
            }
          }
        },
        { rootMargin: '800px 0px' }
      );
      observer.observe(mount);
    } else {
      // No IntersectionObserver (very old browsers): fall back to
      // loading immediately. Better to eat the perf cost than to ship
      // broken buttons.
      loadPreloader();
    }

    // Trigger 2: click on the server-rendered "Write a review" CTA.
    //
    // The CTA carries Judge.me's documented `.jdgm-write-rev-link`
    // class so their preloader binds the form-open handler to it on
    // hydration. But if the user clicks before hydration, the anchor
    // just scrolls. Listening in capture phase lets us start the load
    // before that scroll happens; if the script loads fast enough the
    // bound handler runs against the next click without the user
    // noticing the gap. (We don't synthesize a re-click because that
    // would interfere with users who legitimately want to scroll-only.)
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.('.jdgm-write-rev-link')) return;
      loadPreloader();
    }
    document.addEventListener('click', onClick, true);

    return () => {
      observer?.disconnect();
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return null;
}
