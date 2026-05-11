import Image from 'next/image';
import Link from 'next/link';
import type { ProductSummary } from '@/lib/shopify';
import { formatPriceRange } from '@/lib/format';
import { PcardSpecs } from './pcard-specs';
import { CompareToggle } from './compare-toggle';

/**
 * Single product card on the PLP / search results grid.
 *
 * Phase 215 extraction: previously inlined in
 * `app/collections/[handle]/page.tsx`. Lifted out so the Phase 217
 * client-side `PlpInfiniteScroll` (load-more append) can render
 * card-identical entries below the SSR'd first page. One source of
 * truth, server and client both call into here.
 *
 * Server-component-friendly — no `'use client'`. The nested
 * `<CompareToggle>` is a separate client island; React handles the
 * server/client boundary automatically when this card renders inside
 * either context.
 *
 * `priority` controls eager loading on the LCP candidates (the first
 * 3 cards of the SSR'd first page). Subsequent appended pages should
 * always pass `false`.
 */
export function PlpCard({
  product,
  priority = false,
}: {
  product: ProductSummary;
  priority?: boolean;
}) {
  const minPrice = Number.parseFloat(product.priceRange.minVariantPrice.amount);
  const minCompare = Number.parseFloat(product.compareAtPriceRange.minVariantPrice.amount);
  const onSale = minCompare > 0 && minCompare > minPrice;
  const pctOff = onSale ? Math.round((1 - minPrice / minCompare) * 100) : 0;

  return (
    // Article wraps the link + the CompareToggle as siblings. Previously
    // the Compare <button> sat inside the <Link>, which is HTML5-invalid
    // (a > button) and creates ergonomics weirdness even when
    // stopPropagation cancels the bubble. The article carries the
    // .pcard / .plp-card visual styles; the inner .pcard-link is a
    // flat flex-column for image + meta only.
    <article className="pcard plp-card">
      <Link href={`/products/${product.handle}`} className="pcard-link">
        <div className="ph pcard-img" style={{ aspectRatio: '1' }}>
          {onSale ? (
            <span className="pcard-tag pcard-tag-sale">−{pctOff}%</span>
          ) : null}
          {product.featuredImage ? (
            <Image
              src={product.featuredImage.url}
              alt={product.featuredImage.altText ?? product.title}
              width={600}
              height={600}
              sizes="(max-width: 760px) 100vw, (max-width: 1024px) 50vw, 33vw"
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              priority={priority}
              loading={priority ? 'eager' : 'lazy'}
            />
          ) : (
            <span className="ph-label">[Image coming]</span>
          )}
        </div>
        <div className="pcard-meta">
          <div className="pcard-brand">{product.vendor}</div>
          <div className="pcard-name">{product.title}</div>
          <PcardSpecs specs={product.specs} />
          <div className="pcard-price">
            {onSale ? (
              <span className="pcard-was tnum">
                {formatPriceRange(product.compareAtPriceRange.minVariantPrice, product.compareAtPriceRange.maxVariantPrice)}
              </span>
            ) : null}
            <span className="pcard-now tnum">
              {formatPriceRange(product.priceRange.minVariantPrice, product.priceRange.maxVariantPrice)}
            </span>
          </div>
        </div>
      </Link>
      <CompareToggle handle={product.handle} title={product.title} />
    </article>
  );
}
