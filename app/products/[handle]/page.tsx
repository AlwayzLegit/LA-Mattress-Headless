import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getProductByHandle, getProductRecommendations } from '@/lib/shopify';
import type { Product, ProductSummary } from '@/lib/shopify';
import { products as inventoryProducts, findProduct } from '@/lib/inventory';
import { capTitle, truncDescription, firstNonEmpty } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { Icon } from '@/app/_components/icon';
import { ReviewsBadge } from '@/app/_components/reviews-badge';
import { RecordRecentlyViewed, RecentlyViewedRail } from '@/app/_components/recently-viewed';
import { BuyBox } from './buy-box';
import { PdpCtaRow } from './pdp-cta-row';
import { PdpGallery } from './gallery';
import { PdpOverview } from './pdp-overview';
import { PdpFirmness } from './pdp-firmness';
import { PdpMaterials } from './pdp-materials';
import { RelatedRail } from './related-rail';
import { ProductSkeleton } from './skeleton';

type Params = { params: Promise<{ handle: string }> };

export const revalidate = 600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

export function generateStaticParams() {
  // Skip static pre-rendering when Storefront credentials aren't configured —
  // lets `next build` succeed in a fresh checkout. With env set, we pre-build
  // the top revenue PDPs from §4 of the brief; the rest render on-demand
  // via dynamicParams=true.
  if (!SHOPIFY_CONFIGURED) return [];
  const priorityHandles = new Set([
    'the-luxe-estate-firm-by-stearns-foster',                              // top revenue
    'englander-amsbury-pillow-top-mattress',
    'tempur-pedic-mattress-clearance-tempur-proadapt-medium-12',
    'eastman-house-avalon-late-firm',
    'spruce-firm-innerspring-by-eclipse-mattress',
    'diamond-dreamstage-2-0-collection-glory-firm-cool-gel-swirl-memory-foam-12-mattress',
    'bia-universal-flat-foundation',
    'rock-extra-firm-mattress-diamond-mattress',
    'diamond-dreamstage-2-0-medium-gel-swirl-memory-foam-12-mattress',
    'bunkie-board-mattress-foundation',
    'tempur-pedic-tempur-proadapt-medium-hybrid',
    'tempur-pedic-tempur-luxeadapt-firm-mattress',
    'lismore-luxury-firm-mattress-palace-collection-by-chattam-wells',
    'harvest-green-original-firm-natural-latex-by-diamond-mattress',
  ]);
  return inventoryProducts
    .filter((p) => priorityHandles.has(p.handle))
    .map((p) => ({ handle: p.handle }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Product' };
  const product = await getProductByHandle(params.handle).catch(() => null);
  if (!product) return { title: 'Product not found' };
  const title = capTitle(firstNonEmpty(product.seo.title, product.title));
  const description = truncDescription(
    firstNonEmpty(
      product.seo.description,
      product.description,
      `${product.title} — buy at LA Mattress Store, Los Angeles.`,
    ),
  );
  const url = `/products/${product.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: product.featuredImage ? [{ url: product.featuredImage.url, alt: product.featuredImage.altText ?? product.title }] : [],
    },
  };
}

export default async function ProductPage(props: Params) {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();

  // Hybrid: known handles (in inventory snapshot) take the Suspense fast-path
  // with a skeleton during navigation. Unknown handles fall through to a
  // synchronous fetch — bad URLs hit notFound() OUTSIDE any Suspense, which
  // is the only way to emit a real HTTP 404 in Next 15 (notFound() called
  // inside a Suspense streams as 200 with the not-found body in the chunked
  // response — confirmed in Phase 19).
  if (findProduct(params.handle)) {
    return (
      <Suspense fallback={<ProductSkeleton />}>
        <ProductBody handle={params.handle} />
      </Suspense>
    );
  }

  const product = await getProductByHandle(params.handle).catch(() => null);
  if (!product) notFound();
  const related = await getProductRecommendations(product.handle).catch(() => [] as ProductSummary[]);
  return <ProductView product={product} related={related} />;
}

async function ProductBody({ handle }: { handle: string }) {
  const [product, related] = await Promise.all([
    getProductByHandle(handle).catch(() => null),
    getProductRecommendations(handle).catch(() => [] as ProductSummary[]),
  ]);
  if (!product) notFound();
  return <ProductView product={product} related={related} />;
}

function SpecTable({ product }: { product: Product }) {
  const { specs } = product;
  const sizeOpt = product.options.find((o) => /size/i.test(o.name));
  // Order matches the design handoff §Specs (pdp-showroom.css).
  const rows: { label: string; value: string }[] = [];
  if (specs.heightInches !== null)     rows.push({ label: 'Height',     value: `${specs.heightInches}"` });
  if (specs.firmness)                  rows.push({ label: 'Firmness',   value: specs.firmness });
  if (specs.materialType)              rows.push({ label: 'Materials',  value: specs.materialType });
  else if (product.productType)        rows.push({ label: 'Type',       value: product.productType });
  if (sizeOpt && sizeOpt.values.length) rows.push({ label: 'Sizes',     value: sizeOpt.values.join(', ') });
  if (specs.trialNights !== null)      rows.push({ label: 'Trial',      value: `${specs.trialNights} nights` });
  if (specs.warrantyYears !== null)    rows.push({ label: 'Warranty',   value: `${specs.warrantyYears} years` });
  rows.push({ label: 'Brand', value: product.vendor });

  if (rows.length === 0) return null;
  return (
    <section className="pdp-section pdp-specs">
      <div className="pdp-section-head">
        <div>
          <div className="eyebrow">Specifications</div>
          <h2 className="h2">The details.</h2>
        </div>
      </div>
      <dl className="pdp-specs-grid">
        {rows.map((r) => (
          <div key={r.label} className="pdp-spec">
            <dt className="muted pdp-spec-k">{r.label}</dt>
            <dd className="pdp-spec-v">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SpecStrip({ specs }: { specs: Product['specs'] }) {
  // Render only the spec values that are actually populated. Order matches
  // the buying-decision priority: material → firmness → height. Values
  // separated by middle-dot for a tight, scannable strip.
  const items: string[] = [];
  if (specs.materialType) items.push(specs.materialType);
  if (specs.firmness)     items.push(specs.firmness);
  if (specs.heightInches !== null) items.push(`${specs.heightInches}"`);
  if (items.length === 0) return null;
  return (
    <div className="pdp-spec-strip" aria-label="Mattress specs">
      {items.map((s, i) => (
        <span key={i} className="pdp-spec-strip-item">{s}</span>
      ))}
    </div>
  );
}

function ProductView({ product, related }: { product: Product; related: ProductSummary[] }) {
  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;

  // Google's structured-data guidelines say to omit fields rather than emit
  // empty strings. Some merchants leave SKUs blank in Shopify Admin; only
  // include the sku key when at least one variant has a non-empty SKU.
  const firstSku = product.variants.find((v) => v.sku && v.sku.trim().length > 0)?.sku;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description.slice(0, 5000),
    ...(firstSku ? { sku: firstSku } : {}),
    brand: { '@type': 'Brand', name: product.vendor },
    image: product.images.length ? product.images.map((i) => i.url) : (product.featuredImage ? [product.featuredImage.url] : []),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: min.currencyCode,
      lowPrice: min.amount,
      highPrice: max.amount,
      offerCount: product.variants.length,
      availability: product.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    // Only include aggregateRating when the merchant's review vendor (Judge.me)
    // has populated the reviews.* metafields. Google rejects fabricated values.
    ...(product.reviews
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.reviews.rating.toFixed(1),
            reviewCount: product.reviews.count,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',       item: 'https://mattressstoreslosangeles.com/' },
      { '@type': 'ListItem', position: 2, name: 'Mattresses', item: 'https://mattressstoreslosangeles.com/collections/mattresses' },
      { '@type': 'ListItem', position: 3, name: product.title },
    ],
  };

  return (
    <main className="container pdp">
      <nav className="lp-breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 'var(--s-5)' }}>
        <Link href="/">Home</Link>
        <span className="sep" aria-hidden="true">/</span>
        <Link href="/collections/mattresses">Mattresses</Link>
        <span className="sep" aria-hidden="true">/</span>
        <span>{product.title}</span>
      </nav>

      <div className="pdp-grid pdp-grid-with-body">
        <div className="pdp-left">
        <PdpGallery
          productTitle={product.title}
          featured={product.featuredImage}
          images={product.images}
        />

        <PdpOverview product={product} />
        <PdpFirmness product={product} />
        <PdpMaterials product={product} />
        <SpecTable product={product} />

        {product.descriptionHtml ? (
          <section className="pdp-description">
            <div className="eyebrow">Details</div>
            <h2 className="h2">About this mattress</h2>
            <div className="rte" dangerouslySetInnerHTML={{ __html: sanitizeShopifyHtml(product.descriptionHtml) }} />
          </section>
        ) : null}
        </div>

        <aside className="pdp-rail">
          <div className="pdp-rail-inner">
            <div className="pdp-brand-mark">{product.vendor}</div>
            <h1 className="pdp-name">{product.title}</h1>
            {product.editorial.tagline ? (
              <p className="pdp-tagline muted">{product.editorial.tagline}</p>
            ) : null}
            <ReviewsBadge reviews={product.reviews} size="block" />

            <BuyBox
              options={product.options}
              variants={product.variants}
              priceRange={product.priceRange}
              compareAtPriceRange={product.compareAtPriceRange}
              productTitle={product.title}
              productImage={product.featuredImage}
            />

            <PdpCtaRow
              handle={product.handle}
              title={product.title}
              vendor={product.vendor}
              imageUrl={product.featuredImage?.url ?? null}
              imageAlt={product.featuredImage?.altText ?? null}
              priceAmount={product.priceRange.minVariantPrice.amount}
              priceCurrency={product.priceRange.minVariantPrice.currencyCode}
            />

            <div className="pdp-delivery">
              <div className="pdp-delivery-row">
                <Icon name="truck" size={18} />
                <div>
                  <div className="pdp-delivery-title">Free white-glove delivery</div>
                  <div className="muted pdp-delivery-sub">Free setup &amp; old mattress haul-away · Same-day to 90% of LA</div>
                </div>
              </div>
              <div className="pdp-delivery-row">
                <Icon name="shield" size={18} />
                <div>
                  <div className="pdp-delivery-title">120-night comfort exchange</div>
                  <div className="muted pdp-delivery-sub">Sleep on it for 4 months — exchange free if it isn&rsquo;t right</div>
                </div>
              </div>
              <div className="pdp-delivery-row">
                <Icon name="card" size={18} />
                <div>
                  <div className="pdp-delivery-title">0% APR financing</div>
                  <div className="muted pdp-delivery-sub">Up to 60 months on approved credit · Synchrony or Acima</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <RelatedRail products={related} />
      <RecentlyViewedRail excludeHandle={product.handle} />
      <RecordRecentlyViewed product={product} />

      <script id="ld-product" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <script id="ld-breadcrumb-product" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
