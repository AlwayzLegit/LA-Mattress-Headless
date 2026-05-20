import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getProductByHandle, getProductRecommendations } from '@/lib/shopify';
import type { Product, ProductSummary } from '@/lib/shopify';
import { products as inventoryProducts, findProduct } from '@/lib/inventory';
import { capTitle, truncDescription, firstNonEmpty, stripBrandSuffix } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { Icon } from '@/app/_components/icon';
import { ReviewsBadge } from '@/app/_components/reviews-badge';
import { RecordRecentlyViewed, RecentlyViewedRail } from '@/app/_components/recently-viewed';
import { PdpReviewsSection } from '@/app/_components/pdp-reviews-section';
import { TrackPdpView } from '@/app/_components/track-pdp-view';
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
  // Phase 277c: when Shopify SEO title isn't set (~35% of products per
  // the 2026-05 audit), fall back to a local-intent variant rather than
  // the bare product title. Otherwise the <title> would equal the H1
  // verbatim, triggering SEMrush's "Duplicate content in h1 and title".
  // Only append "in Los Angeles" when the result still fits in TITLE_MAX
  // (70 chars after Phase 289 raised it from 56) so capTitle doesn't
  // ellipsis-truncate it; long product titles fall back to the bare
  // title and rely on the unique variant signature within the first ~70
  // chars to differentiate sibling variants.
  const titleFallback = `${product.title} in Los Angeles`;
  let title = capTitle(
    firstNonEmpty(
      product.seo.title,
      titleFallback.length <= 70 ? titleFallback : product.title,
    ),
  );
  // Guard: the H1 is the bare product.title. If the resolved title
  // collapses to that same string (long product name → fallback to
  // bare title, or a merchant seo.title set identical to the product
  // name), the <title> would duplicate the H1 with no brand. Append
  // the canonical brand suffix so it stays distinct + brand-bearing.
  if (stripBrandSuffix(title).trim().toLowerCase() === product.title.trim().toLowerCase()) {
    title = capTitle(`${product.title} · LA Mattress Store`);
  }
  const description = truncDescription(
    firstNonEmpty(
      product.seo.description,
      product.description,
      `${product.title} — buy at LA Mattress Store, Los Angeles.`,
    ),
  );
  const url = `/products/${product.handle}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      // PDPs almost always have a featuredImage. The fallback to
      // app/opengraph-image.tsx is belt-and-braces for the rare
      // missing-image case — Next.js doesn't auto-merge the file
      // convention into a route's openGraph block.
      images: product.featuredImage
        ? [{ url: product.featuredImage.url, alt: product.featuredImage.altText ?? product.title }]
        : [{ url: '/opengraph-image', width: 1200, height: 630 }],
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
  const minPrice = Number.parseFloat(product.priceRange.minVariantPrice.amount);
  const inStock = product.variants.some((v) => v.availableForSale !== false);
  return (
    <main className="container pdp">
      <TrackPdpView
        handle={product.handle}
        title={product.title}
        vendor={product.vendor}
        productType={product.productType}
        price={Number.isFinite(minPrice) ? minPrice : undefined}
        currency={product.priceRange.minVariantPrice.currencyCode}
        inStock={inStock}
      />
      <nav className="lp-breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 'var(--s-5)' }}>
        <Link href="/">Home</Link>
        <span className="sep" aria-hidden="true">/</span>
        <Link href="/collections/mattresses">Mattresses</Link>
        <span className="sep" aria-hidden="true">/</span>
        <span>{product.title}</span>
      </nav>

      <div className="pdp-grid">
        <div className="pdp-gallery-area">
          <PdpGallery
            productTitle={product.title}
            featured={product.featuredImage}
            images={product.images}
          />
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
                  <div className="muted pdp-delivery-sub">Free setup &amp; old mattress haul-away on orders $499+ · Same-day anywhere in LA when you order by 4pm</div>
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
                  <div className="muted pdp-delivery-sub">Synchrony or Acima · terms vary by approval · apply at checkout</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="pdp-details-area">
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
      </div>

      <PdpReviewsSection
        productGid={product.id}
        productHandle={product.handle}
        reviews={product.reviews}
      />

      <RelatedRail products={related} />
      <RecentlyViewedRail excludeHandle={product.handle} />
      <RecordRecentlyViewed product={product} />

    </main>
  );
}
