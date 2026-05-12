import Image from 'next/image';
import Link from 'next/link';
import type { ProductSummary } from '@/lib/shopify';
import { formatPriceRange } from '@/lib/format';
import { ReviewsBadge } from '@/app/_components/reviews-badge';

type Props = {
  products: ProductSummary[];
  heading?: string;
  eyebrow?: string;
};

/**
 * Cross-sell rail rendered below the PDP description.
 *
 * Returns null when there are no recommendations — better to omit the
 * section than to render an empty header. The rail uses the same .pcard
 * styles as the PLP grid for visual consistency, and a horizontal
 * scrolling overflow for mobile (CSS `.pcard-scroll`).
 */
export function RelatedRail({ products, heading = 'Pairs well with', eyebrow = 'Complete Your Bedroom' }: Props) {
  if (!products.length) return null;
  return (
    <section className="section pdp-related" aria-labelledby="pdp-related-heading">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 id="pdp-related-heading" className="h2">{heading}</h2>
          </div>
        </div>
      </div>
      <div className="pcard-scroll-wrap">
        <div className="pcard-scroll no-scrollbar">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.handle}`} className="pcard pcard-rail">
              <div className="ph pcard-img" style={{ aspectRatio: '1' }}>
                {p.featuredImage ? (
                  <Image
                    src={p.featuredImage.url}
                    alt={p.featuredImage.altText ?? p.title}
                    width={400}
                    height={400}
                    sizes="(max-width: 760px) 60vw, 240px"
                    style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                    loading="lazy"
                  />
                ) : <span className="ph-label">[Image coming]</span>}
              </div>
              <div className="pcard-meta">
                <div className="pcard-brand">{p.vendor}</div>
                <div className="pcard-name">{p.title}</div>
                {p.reviews ? (
                  <div className="pcard-reviews"><ReviewsBadge reviews={p.reviews} size="inline" /></div>
                ) : null}
                <div className="pcard-price">
                  <span className="pcard-now tnum">
                    {formatPriceRange(p.priceRange.minVariantPrice, p.priceRange.maxVariantPrice)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
