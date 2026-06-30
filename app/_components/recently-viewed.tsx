'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product, ProductSummary } from '@/lib/shopify';
import { formatPriceRange } from '@/lib/format';
import { announce } from './announcer';
import { createLocalStoreApi } from './use-local-store';
import { ReviewsBadge } from './reviews-badge';
import { RailScrollButtons } from './sections/rail-scroll-buttons';
import { Icon } from './icon';

const RAIL_ID = 'recently-viewed-rail';

type StoredItem = {
  handle: string;
  title: string;
  vendor: string;
  imgUrl: string | null;
  imgAlt: string | null;
  priceMin: { amount: string; currencyCode: string };
  priceMax: { amount: string; currencyCode: string };
  /** Phase 242: snapshot review aggregates at click time so the rail
   *  can render the star badge without an extra Shopify fetch. */
  rating?: number | null;
  reviewCount?: number | null;
  ts: number;
};

// Phase 214: migrated to shared use-local-store helpers. Unlike
// compare-store and wishlist-store, recently-viewed has no
// cross-component reads (only PDP mount writes; only the rail reads
// on its own mount), so the custom event below exists for symmetry +
// future cross-tab updates rather than current need.
const RECENTLY_VIEWED_API = createLocalStoreApi<StoredItem>({
  key: 'la-mattress.recently-viewed.v1',
  event: 'la-mattress:recently-viewed-change',
  max: 12,
  isValid: (x): x is StoredItem =>
    typeof x === 'object' && x != null && 'handle' in x,
});

/**
 * Records the current PDP into recently-viewed localStorage on mount.
 * Renders nothing. Drop into the PDP and any product detail surface.
 */
export function RecordRecentlyViewed({ product }: { product: Product }) {
  useEffect(() => {
    const item: StoredItem = {
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      imgUrl: product.featuredImage?.url ?? null,
      imgAlt: product.featuredImage?.altText ?? null,
      priceMin: {
        amount: product.priceRange.minVariantPrice.amount,
        currencyCode: product.priceRange.minVariantPrice.currencyCode,
      },
      priceMax: {
        amount: product.priceRange.maxVariantPrice.amount,
        currencyCode: product.priceRange.maxVariantPrice.currencyCode,
      },
      rating: product.reviews?.rating ?? null,
      reviewCount: product.reviews?.count ?? null,
      ts: Date.now(),
    };
    const existing = RECENTLY_VIEWED_API.read().filter((p) => p.handle !== product.handle);
    RECENTLY_VIEWED_API.write([item, ...existing]);
  }, [product]);
  return null;
}

/**
 * Horizontal rail of the visitor's recently-viewed products. Hides itself
 * when the store is empty or contains only one item — a single-item rail
 * is awkward and reads as repetition on the PDP that just recorded it.
 *
 * `excludeHandle` skips the current product so the PDP doesn't show itself.
 */
export function RecentlyViewedRail({
  excludeHandle,
  heading = 'Recently viewed',
  eyebrow = 'Pick up where you left off',
}: {
  excludeHandle?: string;
  heading?: string;
  eyebrow?: string;
}) {
  const [items, setItems] = useState<StoredItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setItems(RECENTLY_VIEWED_API.read());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  const filtered = excludeHandle ? items.filter((p) => p.handle !== excludeHandle) : items;
  if (filtered.length < 2) return null;

  const onClear = () => {
    RECENTLY_VIEWED_API.write([]);
    setItems([]);
    announce('Cleared recently viewed history');
  };

  return (
    <section className="section pdp-related" aria-labelledby="recently-viewed-heading">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 id="recently-viewed-heading" className="h2">{heading}</h2>
          </div>
          <div className="section-head-right">
            <button type="button" className="recently-viewed-clear" onClick={onClear} aria-label="Clear history of recently viewed products">
              <Icon name="close" size={12} aria-hidden /> Clear history
            </button>
            <RailScrollButtons
              railId={RAIL_ID}
              leftLabel="Scroll recently viewed left"
              rightLabel="Scroll recently viewed right"
            />
          </div>
        </div>
      </div>
      <div className="pcard-scroll-wrap">
        <div id={RAIL_ID} className="pcard-scroll no-scrollbar">
          {filtered.map((p) => {
            const summary: Pick<ProductSummary, 'priceRange'> = {
              priceRange: {
                minVariantPrice: p.priceMin,
                maxVariantPrice: p.priceMax,
              },
            };
            return (
              <Link key={p.handle} href={`/products/${p.handle}`} className="pcard pcard-rail">
                <div className="ph pcard-img" style={{ aspectRatio: '1' }}>
                  {p.imgUrl ? (
                    <Image
                      src={p.imgUrl}
                      alt={p.imgAlt ?? p.title}
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
                  {typeof p.rating === 'number' && typeof p.reviewCount === 'number' && p.reviewCount > 0 ? (
                    <div className="pcard-reviews">
                      <ReviewsBadge reviews={{ rating: p.rating, count: p.reviewCount }} size="inline" />
                    </div>
                  ) : null}
                  <div className="pcard-price">
                    <span className="pcard-now tnum">
                      {formatPriceRange(summary.priceRange.minVariantPrice, summary.priceRange.maxVariantPrice)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
