import { JudgemeWidgetLoader } from './judgeme-widget-loader';

/**
 * Embed of Judge.me's official client-side review widget. Phase 247.
 *
 * Judge.me's REST API silently ignores per-product filters on the
 * Public API token tier (Phase 246 diagnostic confirmed). The widget
 * uses a different Judge.me endpoint (api.judge.me/reviews/reviews_for_widget)
 * that DOES filter by product, so this is the working path for
 * per-product review display + the Write-a-Review form.
 *
 * Two pieces:
 *   1. <JudgemeWidgetLoader /> — client component that initializes
 *      `window.jdgm` with the public widget token and injects the
 *      Judge.me preloader from their CDN. See that file for the
 *      loading strategy details (intersection-observer + click
 *      fallback).
 *   2. <div class='jdgm-widget jdgm-review-widget' data-id={Shopify product ID}>
 *      placeholder. The preloader finds this on mount, fetches the
 *      product's reviews, and hydrates the list + write-a-review form
 *      + photo upload + everything.
 *
 * Trade-offs vs the server-side approach we abandoned:
 *   - Client-side hydration: reviews don't appear in initial HTML
 *     (worse for cold LCP, no SEO juice from individual review text
 *     — but the aggregate JSON-LD rating still ships server-side).
 *   - Judge.me's UI styling, not our design system.
 *   - Third-party JS dependency on cdnwidget.judge.me.
 *
 * Use only on pages that actually display per-product reviews (PDPs).
 * The aggregate badge on PLP cards and the homepage carousel stay
 * server-rendered from the Shopify metafield (Phase 241).
 */

type Props = {
  /** Shopify numeric product ID (e.g. "7894217031836"). */
  productId: string;
};

export function JudgemeWidget({ productId }: Props) {
  return (
    <>
      <JudgemeWidgetLoader />
      <div
        id="judgeme-widget-mount"
        className="judgeme-widget-mount"
        // Reserve a minimum vertical space so the lazy widget can
        // hydrate without triggering CLS (Cumulative Layout Shift).
        // Most reviewed products' rendered widget is taller than this;
        // when Judge.me's iframe expands beyond min-height the layout
        // grows downward only (no shift above), which Google doesn't
        // count toward CLS. For unreviewed products the placeholder
        // height is wasted but stays small enough to be acceptable.
        // The id is also a scroll anchor target for the server-rendered
        // "Write a review" CTA in pdp-reviews-section.tsx — pre-widget-
        // hydration the user lands at the placeholder area where the
        // widget appears once the preloader finishes.
        style={{ minHeight: '320px' }}
      >
        <div
          className="jdgm-widget jdgm-review-widget"
          // Phase 248: Judge.me's preloader keys off `data-id`, NOT
          // `data-product-id`. With the wrong attribute name the
          // loader marks the widget `jdgm--done-setup-widget`,
          // fires its cache fetch with an empty
          // `review_widget_product_ids=` query param, gets a 200
          // back with no relevant data, and leaves the widget empty.
          // No JS error, no console warning — fails silent. Caught
          // by Cowork rev-6 P0-1.
          data-id={productId}
        />
      </div>
    </>
  );
}
