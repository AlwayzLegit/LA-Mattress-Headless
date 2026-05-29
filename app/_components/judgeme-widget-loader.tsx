'use client';

import { useEffect, useRef } from 'react';

/**
 * Loads Judge.me's preloader script and force-opens the write-review
 * form when the user clicks the server-rendered "Write a review" CTA.
 *
 * Why this exists (regression report 2026-05-29, second round): the
 * server-rendered CTA in pdp-reviews-section.tsx has class
 * `.jdgm-write-rev-link` and `href="#judgeme-widget-mount"`. PR #334
 * was built on the documented-by-the-community belief that Judge.me's
 * preloader binds an onClick handler to every `.jdgm-write-rev-link`
 * on the page once it hydrates, and that handler opens the form
 * modal in place. On the live PDP this binding does NOT take — the
 * user click triggers only the default anchor scroll + URL fragment
 * (#judgeme-widget-mount appears in the address bar). The "Write a
 * review" form never opens.
 *
 * The previous iteration of this loader fixed a real but DIFFERENT
 * problem (lazyOnload not firing reliably). That fix is preserved
 * below — the script does need to be loaded on a reliable trigger,
 * and the IntersectionObserver path is the right way to do it. But
 * loading the script doesn't help if Judge.me's preloader still
 * doesn't bind to our CTA. We need to drive the form open ourselves.
 *
 * What this does
 * ==============
 * Trigger 1 — IntersectionObserver on the widget mount with 800px
 * rootMargin. Starts loading the preloader as soon as the user
 * scrolls within ~one viewport of the reviews section. By the time
 * they reach the section the script is parsed and Judge.me is
 * hydrating reviews into the widget. This is the perf-preserving
 * path (no preloader fetch for users who never scroll).
 *
 * Trigger 2 — Click (capture phase) on any `.jdgm-write-rev-link`.
 * (a) Ensures the script is loaded (covers users who scrolled past
 *     the intersection trigger or who clicked before it could fire —
 *     e.g. the CTA is above the widget mount and visible immediately).
 * (b) Opens the write-review form by trying, in order:
 *       1. window.jdgm.openForm() — undocumented but historically
 *          exposed by Judge.me's widget after hydration.
 *       2. Programmatically clicking Judge.me's INTERNAL trigger
 *          inside the hydrated widget (their preloader renders one
 *          inside `.jdgm-widget` when the merchant has Write-a-Review
 *          enabled in the dashboard). Their internal button shares
 *          the `.jdgm-write-rev-link` class but is scoped under
 *          `.jdgm-widget`, so we can target it without matching our
 *          own outer CTA.
 *       3. Removing `.jdgm-hidden` from `.jdgm-form-wrapper` to show
 *          the form directly. Last-resort path; only fires if neither
 *          of the above worked within the wait window.
 *     Whichever path fires, calls preventDefault on the original
 *     anchor click to suppress the URL hash + scroll the browser
 *     would otherwise do. The form opens in-place.
 *
 * Why poll + MutationObserver instead of a single check
 * =====================================================
 * The user can click the CTA before Judge.me has hydrated the
 * widget. We need to retry until the trigger appears (or until
 * we give up). MutationObserver wakes us only on real DOM change,
 * which is the right cost profile (no setInterval polling on the
 * main thread). A timeout cap (15s) prevents pathological cases
 * where Judge.me's preloader never finishes (e.g. network failure)
 * from leaving an observer attached for the page lifetime.
 *
 * Why not use Next/Script
 * =======================
 * Same reason as the first round of this fix: `strategy="lazyOnload"`
 * waits for `window.load` + `requestIdleCallback`, which on real
 * PDPs heavy with analytics never reliably fires. `afterInteractive`
 * works but forces the ~80KB preloader fetch on every PDP regardless
 * of whether the user scrolls to reviews (Phase 257 measured this as
 * a 80–150ms TBT regression). The intersection trigger preserves the
 * perf benefit while making the load reliable.
 *
 * The config (SHOP_DOMAIN, PLATFORM, PUBLIC_TOKEN) is public-by-
 * design — it appears in the rendered HTML of every Judge.me install
 * — so hardcoding here is fine.
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
      openForm?: () => void;
      [k: string]: unknown;
    };
  }
}

export function JudgemeWidgetLoader() {
  // Track whether we already started a form-open flow for the
  // current click, so a slow user double-tap doesn't queue two
  // overlapping MutationObservers.
  const openFlowActiveRef = useRef(false);

  useEffect(() => {
    let scriptLoaded = false;

    function loadPreloader() {
      if (scriptLoaded) return;
      scriptLoaded = true;
      window.jdgm = window.jdgm || {};
      window.jdgm.SHOP_DOMAIN = JUDGEME_SHOP_DOMAIN;
      window.jdgm.PLATFORM = 'shopify';
      window.jdgm.PUBLIC_TOKEN = JUDGEME_WIDGET_TOKEN;
      // Guard against a stray double-call appending two script tags
      // (e.g. observer fires and a click fires in the same tick).
      if (document.querySelector(`script[src="${PRELOADER_SRC}"]`)) return;
      const s = document.createElement('script');
      s.src = PRELOADER_SRC;
      s.async = true;
      document.head.appendChild(s);
    }

    // Returns true if we successfully opened the form via any path.
    function tryOpenForm(): boolean {
      // Path 1 — Judge.me's exposed API (when present).
      if (typeof window.jdgm?.openForm === 'function') {
        try {
          window.jdgm.openForm();
          return true;
        } catch {
          // fall through
        }
      }
      // Path 2 — click their internal trigger inside the hydrated
      // widget. Scoped under `.jdgm-widget` so we don't match our
      // own outer CTA. We also accept the `.jdgm-write-review-btn`
      // variant Judge.me has used in some widget versions.
      const internal = document.querySelector(
        '.jdgm-widget .jdgm-write-rev-link, ' +
          '.jdgm-widget .jdgm-write-review-btn, ' +
          '.jdgm-widget [data-action="open-review-form"]'
      );
      if (internal instanceof HTMLElement) {
        internal.click();
        return true;
      }
      // Path 3 — last-resort: unhide the form directly. Judge.me
      // toggles `.jdgm-hidden` on `.jdgm-form-wrapper` to gate the
      // form modal. If we got here neither Path 1 nor Path 2 worked,
      // but the widget hydrated the form HTML — surface it manually.
      const form = document.querySelector('.jdgm-form-wrapper');
      if (form instanceof HTMLElement) {
        form.classList.remove('jdgm-hidden');
        form.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return true;
      }
      return false;
    }

    // Wait for the widget to hydrate, then attempt to open the form.
    // Cleans itself up on success or after the timeout cap.
    function waitForHydrationAndOpen(maxMs: number) {
      // Immediate attempt — widget may already be hydrated when the
      // user clicks (e.g. they scrolled past the IntersectionObserver
      // trigger and dwelled long enough for the script to finish).
      if (tryOpenForm()) {
        openFlowActiveRef.current = false;
        return;
      }
      const startedAt = Date.now();
      const observer = new MutationObserver(() => {
        if (tryOpenForm()) {
          observer.disconnect();
          openFlowActiveRef.current = false;
          return;
        }
        if (Date.now() - startedAt > maxMs) {
          observer.disconnect();
          openFlowActiveRef.current = false;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // Belt-and-braces: a hard timeout in case the widget never
      // mutates the DOM after script load (e.g. cdnwidget.judge.me
      // is blocked by an ad-blocker or network failure).
      setTimeout(() => {
        observer.disconnect();
        openFlowActiveRef.current = false;
      }, maxMs);
    }

    // Trigger 1: IntersectionObserver on the widget mount.
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
      loadPreloader();
    }

    // Trigger 2: click on `.jdgm-write-rev-link` (capture phase, so
    // we run before the browser starts its default anchor scroll).
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest) return;
      // Only fire on our EXTERNAL CTA — anchors that sit inside the
      // `.jdgm-widget` mount belong to Judge.me's own hydrated UI
      // and Judge.me will handle their clicks. Calling preventDefault
      // on those would double-handle the click and likely break
      // their form-open flow.
      const externalCta =
        target.closest('.jdgm-write-rev-link') &&
        !target.closest('.jdgm-widget');
      if (!externalCta) return;
      // Suppress the default anchor scroll + URL fragment so the
      // user doesn't see a hash appear in the address bar with
      // nothing else happening. The form opening below provides
      // the visual feedback instead.
      e.preventDefault();
      loadPreloader();
      // Bring the widget area into view while we wait for the form
      // to open. Smooth scroll feels intentional even on the rare
      // path where the widget takes ~1s to hydrate.
      mount?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (openFlowActiveRef.current) return;
      openFlowActiveRef.current = true;
      // 15s cap — long enough for slow networks to download the
      // preloader and hydrate, short enough that a broken widget
      // doesn't leak observers across SPA navigations.
      waitForHydrationAndOpen(15000);
    }
    document.addEventListener('click', onClick, true);

    return () => {
      observer?.disconnect();
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return null;
}
