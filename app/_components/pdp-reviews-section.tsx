import { ReviewsBadge } from './reviews-badge';
import { shopifyProductIdFromGid } from '@/lib/judgeme';
import { JudgemeWidget } from './judgeme-widget';
import { StripInternalNofollow } from './strip-internal-nofollow';
import { TrackReviewWidget } from './track-review-widget';
import type { ProductReviews } from '@/lib/shopify';

/**
 * Customer Reviews section on the PDP.
 *
 * Phase 247: pivoted from server-side Judge.me REST API to their official
 * client-side widget. The REST API at /api/v1/reviews silently ignores
 * every filter param (external_id, product_external_id, product_id) on
 * this token tier — we tried 9 variants in Phase 246's diagnostic, all
 * returned identical unfiltered results. The widget uses a different
 * Judge.me endpoint (api.judge.me/reviews/reviews_for_widget) that
 * properly filters per-product because that's what the widget is for.
 *
 * What this renders now:
 *   - Aggregate header (stars + count) from `product.reviews` — that's
 *     populated server-side via the `judgeme.badge` Shopify metafield
 *     (Phase 241), so it's available at SSR time and emits in JSON-LD
 *     aggregateRating. Works without the widget JS even loading.
 *   - <JudgemeWidget /> placeholder div. Judge.me's preloader JS (loaded
 *     globally in layout.tsx) finds the placeholder, fetches the reviews
 *     for this product, and hydrates the list + Write-a-Review form +
 *     photo upload. Their UI styling, not ours.
 */
type Props = {
  productGid: string;
  productHandle: string;
  reviews: ProductReviews | null;
};

export function PdpReviewsSection({ productGid, productHandle, reviews }: Props) {
  const productId = shopifyProductIdFromGid(productGid);

  return (
    <section className="pdp-reviews" aria-labelledby={`reviews-h-${productHandle}`}>
      <header className="pdp-reviews-head">
        <h2 id={`reviews-h-${productHandle}`} className="h2 pdp-reviews-title">Customer reviews</h2>
        {reviews ? (
          <div className="pdp-reviews-summary" aria-label={`${reviews.rating.toFixed(1)} out of 5, ${reviews.count} reviews`}>
            <ReviewsBadge reviews={reviews} size="block" />
            <span className="muted pdp-reviews-summary-count">
              · {reviews.count.toLocaleString()} review{reviews.count === 1 ? '' : 's'}
            </span>
          </div>
        ) : null}
      </header>

      {/* Phase 308 rollback (2026-05-29): the always-visible
          `.jdgm-write-rev-link` CTA originally added in #334 was
          built on the belief that Judge.me's preloader binds a
          click handler to anchors with that class once the widget
          hydrates. On the live PDP that binding never took, the
          button visually existed but only ever triggered the
          default anchor scroll + URL hash, with no form opening.
          Two follow-up fixes (#350, #353) tried to repair the
          wiring without browser access to verify, and both deployed
          without moving the needle for the user. Removing the
          external CTA entirely so the only Write-a-Review surface
          is the one Judge.me renders INSIDE the hydrated widget
          (gated by the dashboard's Write-a-Review toggle). Their
          internal button is wired by their own JS and works
          consistently across configurations. The aggregate badge +
          review count above stays in place and still tells the
          shopper this product has reviews even when they haven't
          scrolled to the widget yet. */}

      {/* Phase 249: dropped the LA Mattress-side "Be the first to review X"
          server copy on 0-review PDPs. Judge.me's widget hydrates its own
          empty state ("Be the first to write a review" + Write/Ask buttons)
          which covers the same user need without the redundancy that
          confused Cowork rev-7. */}
      {productId ? (
        <>
          <JudgemeWidget productId={productId} />
          <TrackReviewWidget productId={productId} />
          {/* Strips rel="nofollow" off the Judge.me widget's internal
              links (Semrush 20260602: ~240 PDPs flagged "nofollow
              attributes in internal links"). Re-added after the #12
              investigation: it had been removed on a hunch that it broke
              "Load more", but Judge.me confirmed that bug was their NEW
              widget mis-binding on headless, they switched the shop to
              the LEGACY widget, which is what this component ran
              alongside in production for months without issue. It only
              mutates the `rel` attribute (no node moves) and skips
              mutations inside the live widget, so it doesn't touch the
              widget's pagination/form behavior. */}
          <StripInternalNofollow />
        </>
      ) : (
        <p className="muted">
          Reviews unavailable for this product right now.
        </p>
      )}
    </section>
  );
}
