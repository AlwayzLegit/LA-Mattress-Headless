'use client';

import { useEffect } from 'react';
import { stripInternalNofollowFromRel } from '@/lib/strip-nofollow';

/**
 * Strips rel="nofollow" / "sponsored" / "ugc" from anchors whose href
 * is internal (root-relative path, in-page fragment, OR absolute URL
 * matching window.location.origin).
 *
 * Background — SEMrush 20260521_1 follow-up: 334 PDPs flagged
 * "Nofollow attributes in internal links". Server-side
 * sanitizeShopifyHtml.stripInternalLinkNofollow already runs on every
 * merchant body (verified clean on a sample of 8 PDPs via Shopify
 * Admin MCP). The residual source is Judge.me's review widget, which
 * loads client-side via Script and injects its own anchors AFTER page
 * load — out of reach of the server-side pass.
 *
 * Judge.me's injected anchors include:
 *   - "Write a Review" → href="#jdgm-write-review-form" rel="nofollow"
 *   - Reply / Helpful actions → form anchors with rel="nofollow"
 *   - Pagination → in-page anchors with rel="nofollow"
 *   - Review-permalink share trays (Phase 306) — absolute self-host
 *     URLs to the PDP itself, sometimes appended at document.body
 *     level rather than inside the widget mount
 *
 * All of these point to in-page fragments or same-host paths — i.e.
 * "internal" — so rel="nofollow" wastes a tiny bit of internal link
 * equity for no benefit (Google retired the crawl-budget rationale
 * in 2019). External Judge.me URLs (judge.me/u/whatever) keep their
 * nofollow untouched.
 *
 * Cost: one MutationObserver on document.body for the page lifetime.
 * The handler filters on `a[rel]` descendants so the vast majority
 * of unrelated DOM churn (analytics, Next.js prefetches, route
 * transitions, etc.) is skipped in O(1). Phase 306 widened scope from
 * `.judgeme-widget-mount` to `document.body` because Judge.me's modal
 * overlays and share-trays render outside the mount container; the
 * narrower scope let those slip past and SEMrush kept flagging them
 * (277 PDPs in the 20260527 re-crawl).
 */
export function StripInternalNofollow() {
  useEffect(() => {
    // Pass `window.location.origin` so absolute self-host URLs (e.g.
    // `https://mattressstoreslosangeles.com/products/X`) count as
    // internal too. Judge.me's widget injects same-site permalinks in
    // absolute form; the 2026-05-25 SEMrush drill-down identified these
    // as the source of all 299 nofollowed-internal-link flags (one
    // self-loop per PDP). Without `siteOrigin`, isInternalHref only
    // matches `/path` / `#frag` and the absolute self-links slipped
    // past.
    const siteOrigin = window.location.origin;

    const applyTo = (anchor: HTMLAnchorElement) => {
      const href = anchor.getAttribute('href');
      const rel = anchor.getAttribute('rel');
      if (!rel) return;
      const cleaned = stripInternalNofollowFromRel(href, rel, siteOrigin);
      if (cleaned === rel) return;
      if (cleaned === '') {
        anchor.removeAttribute('rel');
      } else {
        anchor.setAttribute('rel', cleaned);
      }
    };

    // Initial pass — strip anything already on the page. Judge.me's
    // preloader loads `lazyOnload`, so on first paint the widget mount
    // is usually empty; but if the widget has already hydrated (e.g.
    // BFCache restore, route re-entry), we want to catch those anchors
    // right away.
    document.querySelectorAll('a[rel]').forEach((a) => applyTo(a as HTMLAnchorElement));

    // Phase 306: SEMrush 20260527 still flagged 277 PDPs with internal
    // nofollow links despite the 20260525 fix. Diagnosis: the previous
    // observer was scoped to `.judgeme-widget-mount`, but Judge.me's
    // widget appends some interactive elements (the write-review modal
    // overlay, the photo-upload popover, the "share this review" tray)
    // directly to `document.body` — outside the mount container.
    // Those anchors slip past the scoped observer.
    //
    // Fix: observe `document.body` for the whole page lifetime, but
    // filter aggressively in the handler so we only re-process nodes
    // that could plausibly carry rel="nofollow". Touching every <a>
    // tag injected anywhere in the document would be wasteful; the
    // filter keeps the per-event work bounded.
    //
    // 2026-05-28: Skip mutations whose target sits inside the live
    // `.jdgm-widget` mount. Judge.me's pagination ("Load more")
    // injects new review cards there in batches; our rel-mutating
    // setAttribute on each batch was a candidate cause of the
    // user-reported "Load more doesn't work" bug. Modal overlays /
    // share-trays / photo popovers append at document.body level
    // (outside `.jdgm-widget`) so this skip preserves Phase 306's
    // SEMrush fix for those without poking the widget's internal
    // state during pagination.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // m.target is the parent node whose children list changed.
        // Skip if it lives inside the Judge.me review widget — those
        // mutations are part of the widget's own pagination/render
        // pipeline and shouldn't be touched by our rel-stripping pass.
        const target = m.target;
        if (target instanceof Element && target.closest('.jdgm-widget')) continue;
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          // Direct <a> insertion — check it.
          if (node.tagName === 'A' && node.hasAttribute('rel')) {
            applyTo(node as HTMLAnchorElement);
            continue;
          }
          // Subtree insertion (a whole Judge.me card, a modal, etc.).
          // Only walk if there's at least one anchor with `rel`
          // descendant inside, so we skip the bulk of unrelated DOM
          // churn (analytics scripts, Next.js prefetches, etc.).
          const candidates = node.querySelectorAll?.('a[rel]');
          if (candidates && candidates.length > 0) {
            candidates.forEach((a) => applyTo(a as HTMLAnchorElement));
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
