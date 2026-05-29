import Script from 'next/script';

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
 *   1. <Script> tags that initialize `window.jdgm` with the public
 *      widget token + load Judge.me's preloader from their CDN.
 *      `strategy="afterInteractive"` runs them right after React
 *      hydration so the widget is guaranteed to load (unlike
 *      `lazyOnload`, which waits for `window.load` +
 *      `requestIdleCallback` and can stall indefinitely on heavy
 *      PDPs with PostHog autocapture + GA4 in flight). The
 *      preloader is the version Judge.me's documented setup uses,
 *      so its execution context matches what the widget expects.
 *   2. <div class='jdgm-widget jdgm-review-widget' data-id={Shopify product ID}>
 *      placeholder. The preloader finds this on mount, fetches the
 *      product's reviews, and hydrates the list + write-a-review form
 *      + photo upload + everything.
 *
 * The token is public-by-design — it appears in the rendered HTML of
 * every Judge.me widget install — so hardcoding it here is fine.
 *
 * Use only on pages that actually display per-product reviews (PDPs).
 * The aggregate badge on PLP cards and the homepage carousel stay
 * server-rendered from the Shopify metafield (Phase 241).
 *
 * Phase 308 (2026-05-29 rollback): two PRs (#350 + #353) tried to
 * fix a user-reported "Write a review / Load more don't work" issue
 * by replacing this with an IntersectionObserver-based loader and
 * then by adding programmatic form-open handlers. Both deployed,
 * neither moved the needle for the user. Symptom on the live site:
 * page scrolled but the form never opened, AND Judge.me's own
 * pagination ("Load more") was also non-functional — meaning the
 * issue is upstream of any external CTA wiring. Rolling back to this
 * minimal integration so Judge.me's own widget UI takes over the
 * full reviews section without our code adding wiring assumptions.
 * The custom `.jdgm-write-rev-link` CTA in pdp-reviews-section.tsx
 * (added in #334) is removed in the same rollback — Judge.me renders
 * its own Write-a-Review button inside the hydrated widget when the
 * dashboard's Write-a-Review toggle is enabled.
 */
const JUDGEME_WIDGET_TOKEN = '9MsdQpWBCXmPK-berSnU7a6TUPs';
const JUDGEME_SHOP_DOMAIN = 'la-mattress.myshopify.com';

type Props = {
  /** Shopify numeric product ID (e.g. "7894217031836"). */
  productId: string;
};

export function JudgemeWidget({ productId }: Props) {
  return (
    <>
      <Script
        id="judgeme-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `jdgm = window.jdgm || {}; jdgm.SHOP_DOMAIN = '${JUDGEME_SHOP_DOMAIN}'; jdgm.PLATFORM = 'shopify'; jdgm.PUBLIC_TOKEN = '${JUDGEME_WIDGET_TOKEN}';`,
        }}
      />
      <Script
        id="judgeme-preloader"
        strategy="afterInteractive"
        src="https://cdnwidget.judge.me/widget_preloader.js"
      />
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
