'use client';

import { useEffect } from 'react';
import { stripInternalNofollowFromRel } from '@/lib/strip-nofollow';

/**
 * Strips rel="nofollow" / "sponsored" / "ugc" from anchors whose href
 * is internal (root-relative path or in-page fragment) inside the
 * Judge.me widget container.
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
 *
 * All of these point to in-page fragments or same-host paths — i.e.
 * "internal" — so rel="nofollow" wastes a tiny bit of internal link
 * equity for no benefit (Google retired the crawl-budget rationale
 * in 2019). External Judge.me URLs (judge.me/u/whatever) keep their
 * nofollow untouched.
 *
 * Cost: one MutationObserver per PDP, attached on mount, disconnected
 * on unmount. The observer is scoped to `.judgeme-widget-mount` so it
 * doesn't see the whole DOM. Initial pass strips anything already in
 * the container at mount time; the observer catches Judge.me's later
 * re-renders (review pagination, etc).
 */
export function StripInternalNofollow() {
  useEffect(() => {
    const root = document.querySelector('.judgeme-widget-mount');
    if (!root) return;

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

    // Initial pass — strip anything already in the widget container.
    root.querySelectorAll('a').forEach((a) => applyTo(a as HTMLAnchorElement));

    // Watch for Judge.me's later DOM injections (review pagination,
    // form submissions that swap the write-review subtree, etc.).
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.tagName === 'A') {
            applyTo(node as HTMLAnchorElement);
          }
          // Newly-added subtrees may contain <a> descendants Judge.me
          // injects in a single batch (e.g. a whole review card).
          node.querySelectorAll?.('a').forEach((a) => applyTo(a as HTMLAnchorElement));
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
