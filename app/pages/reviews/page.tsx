import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';
import { getShopAggregate, getStorefrontReviews, type JudgemeReview } from '@/lib/judgeme';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

const SITE = 'https://mattressstoreslosangeles.com';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Customer Reviews',
  description:
    'Read verified customer reviews of LA Mattress Store. Real shoppers, real beds, real opinions — collected via Judge.me from buyers across Los Angeles.',
  alternates: { canonical: `${SITE}/pages/reviews` },
};

export default async function ReviewsPage() {
  const [aggregate, reviews] = await Promise.all([
    getShopAggregate(),
    getStorefrontReviews({ perPage: 24, minRating: 4 }),
  ]);

  // No reviews available yet (Judge.me not configured, or no published 4★+
  // reviews). Show a soft-empty state so the page still has shape.
  if (!aggregate || reviews.length === 0) {
    return (
      <main className="container reviews-page">
        <header className="reviews-page-hero">
          <div className="eyebrow">From our customers</div>
          <h1 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>Customer reviews</h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.55, maxWidth: '60ch' }}>
            We&rsquo;re collecting verified reviews from real LA Mattress shoppers. Check back
            soon — or{' '}
            <a href={`tel:${SITE_PHONE_TEL}`} className="link-arrow">
              call us at {SITE_PHONE_DISPLAY} <Icon name="phone" size={14} />
            </a>{' '}
            to hear directly from a sleep consultant.
          </p>
        </header>
      </main>
    );
  }

  const aggregateLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'LA Mattress Store',
    url: SITE,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: aggregate.rating.toFixed(1),
      reviewCount: aggregate.count,
      bestRating: '5',
      worstRating: '1',
    },
  };

  return (
    <main className="container reviews-page">
      <nav className="lp-breadcrumbs" style={{ paddingTop: 'var(--s-5)' }}>
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <span>Reviews</span>
      </nav>

      <header className="reviews-page-hero">
        <div className="eyebrow">From our customers</div>
        <h1 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>Customer reviews</h1>
        <div className="reviews-page-aggregate">
          <ReviewStars rating={aggregate.rating} size="lg" />
          <span className="reviews-page-aggregate-num tnum">
            {aggregate.rating.toFixed(1)} / 5
          </span>
          <span className="reviews-page-aggregate-count muted">
            · {aggregate.count.toLocaleString()} verified review{aggregate.count === 1 ? '' : 's'}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.55, maxWidth: '60ch', marginTop: 'var(--s-4)' }}>
          These are real reviews from verified LA Mattress Store shoppers, collected via Judge.me.
          We don&rsquo;t edit them, we don&rsquo;t cherry-pick — what you see is what they wrote.
        </p>
      </header>

      <ul className="reviews-grid" aria-label="Customer reviews">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </ul>

      <footer className="reviews-page-footer">
        <p className="muted" style={{ maxWidth: '60ch', fontSize: 15, lineHeight: 1.6 }}>
          Just bought a mattress? You&rsquo;ll get a request from Judge.me a couple weeks
          after delivery. Honest reviews — good or bad — help everyone shop smarter.
        </p>
        <Link href="/collections/mattresses" className="btn btn-primary">
          Shop mattresses <Icon name="arrow-right" size={14} />
        </Link>
      </footer>

      <script
        id="ld-reviews-aggregate"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aggregateLd) }}
      />
    </main>
  );
}

function ReviewCard({ review }: { review: JudgemeReview }) {
  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <li className="review-card">
      <div className="review-card-head">
        <ReviewStars rating={review.rating} />
        {review.verified ? (
          <span className="review-card-verified" title="Verified buyer">
            <Icon name="check" size={12} /> Verified
          </span>
        ) : null}
      </div>
      {review.title ? <h2 className="review-card-title">{review.title}</h2> : null}
      <p className="review-card-body">{review.body}</p>
      <div className="review-card-meta muted">
        <span>{review.reviewer.name || 'Anonymous'}</span>
        <span>·</span>
        <time dateTime={review.created_at}>{date}</time>
      </div>
    </li>
  );
}

function ReviewStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 18 : 14;
  const full = Math.round(rating);
  return (
    <span className={`review-stars review-stars-${size}`} aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'review-star-on' : 'review-star-off'}>
          <Icon name="star" size={px} />
        </span>
      ))}
    </span>
  );
}
