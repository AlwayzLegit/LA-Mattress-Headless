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
 *      The token is public-by-design — it appears in the rendered
 *      HTML of every Judge.me widget install — so hardcoding it
 *      here is fine.
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
        className="judgeme-widget-mount"
        // The preloader scans the DOM for these data-* attributes and
        // hydrates each match with the product's review widget.
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
