'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

/**
 * Tracks interactions with the embedded Judge.me review widget.
 *
 * The widget is a third-party iframe-like client-side blob hydrated by
 * cdnwidget.judge.me into the .jdgm-widget mount. We can't modify
 * their HTML, so we use a delegated click listener on the document body
 * that filters for Judge.me's documented class selectors. This is the
 * same pattern Judge.me's own GA + GTM integration docs use.
 *
 * Three actions are tracked, all rate-limited to once per second per
 * action to avoid double-fires on rapid clicks / drag-selects:
 *
 *   - write_form_opened: user clicked the "Write a Review" CTA
 *     (.jdgm-write-rev-link or [data-action="open-review-form"]).
 *   - review_submitted: user submitted the review form
 *     (.jdgm-form button[type="submit"] click after the form is open).
 *   - pagination_clicked: user clicked next/prev to see more reviews
 *     (.jdgm-paginate__page, .jdgm-paginate__next-page,
 *      .jdgm-paginate__prev-page).
 *
 * `productId` is the Shopify numeric product ID the widget is bound to.
 * It comes from the parent PDP server component so we can attribute the
 * interaction to the right product.
 *
 * No-op when there's no `.jdgm-widget` mount on the page (lets us drop
 * this component on every PDP without conditional rendering — the
 * widget render decision still lives in judgeme-widget.tsx).
 */
export function TrackReviewWidget({ productId }: { productId: string }) {
  const lastFiredRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!productId) return;
    if (typeof document === 'undefined') return;

    const RATE_MS = 1000;

    function fire(action: 'write_form_opened' | 'review_submitted' | 'pagination_clicked' | 'photo_opened') {
      const now = Date.now();
      const last = lastFiredRef.current[action] ?? 0;
      if (now - last < RATE_MS) return;
      lastFiredRef.current[action] = now;
      track('review_widget_interaction', { product_id: productId, action });
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest) return;

      // Match a known Judge.me selector — `closest` walks up the DOM so
      // a click on the icon inside the button still matches the button.
      // Order from most-specific to most-generic.
      if (target.closest('.jdgm-form button[type="submit"], .jdgm-form .jdgm-submit-rev')) {
        fire('review_submitted');
        return;
      }
      if (target.closest('.jdgm-write-rev-link, [data-action="open-review-form"], .jdgm-write-review')) {
        fire('write_form_opened');
        return;
      }
      if (target.closest('.jdgm-paginate__page, .jdgm-paginate__next-page, .jdgm-paginate__prev-page')) {
        fire('pagination_clicked');
        return;
      }
      if (target.closest('.jdgm-rev__pic, .jdgm-rev__pic-img, .jdgm-image-modal')) {
        fire('photo_opened');
        return;
      }
    }

    // Capture phase so we win against Judge.me's own listeners (some
    // of which call stopPropagation in the bubble phase).
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [productId]);

  return null;
}
