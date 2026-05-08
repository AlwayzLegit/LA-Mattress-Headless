import { Icon } from './icon';
import type { ProductReviews } from '@/lib/shopify';

type Props = {
  reviews: ProductReviews | null;
  /** Layout variant. `inline` is small + compact; `block` is larger for PDP. */
  size?: 'inline' | 'block';
};

/**
 * Renders aggregate rating + count when reviews data is available, null
 * otherwise. Wired to product.reviews populated from Judge.me metafields
 * (lib/shopify/queries/product.ts → parseReviewsMetafields).
 *
 * Stays null until Judge.me is installed AND the merchant exposes the
 * `reviews.rating` + `reviews.rating_count` metafields to the Storefront
 * API. Until then the storefront shows no rating UI — better than
 * fabricated counts (FTC compliance).
 */
export function ReviewsBadge({ reviews, size = 'inline' }: Props) {
  if (!reviews) return null;

  const { rating, count } = reviews;
  const fontSize = size === 'block' ? 14 : 13;
  const iconSize = size === 'block' ? 14 : 12;

  // Below 3 reviews, the numeric average reads as artificially clean
  // ("5.0 (1)") and erodes trust. Show the count alone instead.
  if (count < 3) {
    return (
      <span className="reviews-badge muted" style={{ fontSize }}>
        {count} review{count === 1 ? '' : 's'}
      </span>
    );
  }

  return (
    <div
      className="reviews-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize,
        color: 'var(--text)',
      }}
      aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${count} review${count === 1 ? '' : 's'}`}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--accent)' }}>
        <Icon name="star" size={iconSize} />
      </span>
      <span className="tnum" style={{ fontWeight: 500 }}>
        {rating.toFixed(1)}
      </span>
      <span className="muted">
        ({count.toLocaleString()})
      </span>
    </div>
  );
}
