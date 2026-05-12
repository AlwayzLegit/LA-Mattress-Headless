import { Icon } from './icon';
import { getProductReviews, shopifyProductIdFromGid, type JudgemeReview } from '@/lib/judgeme';
import { PdpWriteReview } from './pdp-write-review';
import type { ProductReviews } from '@/lib/shopify';

/**
 * Customer Reviews section on the PDP. Server-rendered list of the 8 most
 * recent reviews for this product, plus the inline Write-a-Review form
 * (client island). Phase 238.
 *
 * Visibility:
 *   - If Judge.me isn't configured (env vars missing), or the API call
 *     fails, we still render the Write-a-Review form but with a soft
 *     empty list state. That way new shoppers can leave reviews even on
 *     day one of the headless cutover, before any reviews have synced.
 *   - The summary (avg + count) is fed from `product.reviews` which
 *     comes from Shopify metafields — works even when the Judge.me
 *     Public API is unreachable.
 */
type Props = {
  productGid: string;
  productHandle: string;
  productTitle: string;
  reviews: ProductReviews | null;
};

export async function PdpReviewsSection({ productGid, productHandle, productTitle, reviews }: Props) {
  const productId = shopifyProductIdFromGid(productGid);
  const list: JudgemeReview[] = productId ? await getProductReviews(productId, { perPage: 8 }) : [];

  return (
    <section className="pdp-reviews" aria-labelledby={`reviews-h-${productHandle}`}>
      <header className="pdp-reviews-head">
        <h2 id={`reviews-h-${productHandle}`} className="h2 pdp-reviews-title">Customer reviews</h2>
        {reviews ? (
          <div className="pdp-reviews-summary" aria-label={`${reviews.rating.toFixed(1)} out of 5, ${reviews.count} reviews`}>
            <ReviewStars rating={reviews.rating} size="lg" />
            <span className="pdp-reviews-avg tnum">{reviews.rating.toFixed(1)}</span>
            <span className="muted">/ 5 · {reviews.count.toLocaleString()} review{reviews.count === 1 ? '' : 's'}</span>
          </div>
        ) : (
          <p className="muted pdp-reviews-empty">
            Be the first to review this mattress.
          </p>
        )}
      </header>

      {list.length > 0 ? (
        <ul className="pdp-reviews-list" aria-label="Reviews">
          {list.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </ul>
      ) : null}

      <PdpWriteReview productId={productId ?? ''} productTitle={productTitle} />
    </section>
  );
}

function ReviewCard({ review }: { review: JudgemeReview }) {
  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <li className="pdp-review-card">
      <div className="pdp-review-card-head">
        <ReviewStars rating={review.rating} />
        {review.verified ? (
          <span className="pdp-review-verified" title="Verified buyer">
            <Icon name="check" size={12} /> Verified
          </span>
        ) : null}
      </div>
      {review.title ? <h3 className="pdp-review-title">{review.title}</h3> : null}
      <p className="pdp-review-body">{review.body}</p>
      <div className="pdp-review-meta muted">
        <span>{review.reviewer.name || 'Anonymous'}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={review.created_at}>{date}</time>
      </div>
    </li>
  );
}

function ReviewStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 18 : 14;
  const full = Math.round(rating);
  return (
    <span className={`pdp-review-stars pdp-review-stars-${size}`} aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'pdp-review-star-on' : 'pdp-review-star-off'}>
          <Icon name="star" size={px} />
        </span>
      ))}
    </span>
  );
}
