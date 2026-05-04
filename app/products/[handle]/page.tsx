import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getProductByHandle } from '@/lib/shopify';
import { products as inventoryProducts } from '@/lib/inventory';
import { formatMoney, formatPriceRange } from '@/lib/format';
import { capTitle, truncDescription, firstNonEmpty } from '@/lib/seo';
import { Icon } from '@/app/_components/icon';
import { BuyBox } from './buy-box';

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
  const product = await getProductByHandle(params.handle).catch(() => null);
  if (!product) notFound();

  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;
  const compareMin = product.compareAtPriceRange.minVariantPrice;
  const onSale =
    Number.parseFloat(compareMin.amount) > 0 &&
    Number.parseFloat(compareMin.amount) > Number.parseFloat(min.amount);

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description.slice(0, 5000),
    sku: product.variants[0]?.sku ?? undefined,
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
      <nav className="lp-breadcrumbs" style={{ paddingTop: 'var(--s-5)' }}>
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <Link href="/collections/mattresses">Mattresses</Link>
        <span className="sep">/</span>
        <span>{product.title}</span>
      </nav>

      <div className="pdp-grid">
        <section className="pdp-gallery">
          {product.featuredImage ? (
            <Image
              src={product.featuredImage.url}
              alt={product.featuredImage.altText ?? product.title}
              width={1200}
              height={1200}
              className="pdp-hero-img"
              sizes="(max-width: 880px) 100vw, 60vw"
              priority
            />
          ) : (
            <div className="ph pdp-hero-img"><span className="ph-label">[Image coming]</span></div>
          )}
          {product.images.length > 1 ? (
            <div className="pdp-thumbs">
              {product.images.slice(1, 6).map((img, i) => (
                <Image
                  key={i}
                  src={img.url}
                  alt={img.altText ?? `${product.title} view ${i + 2}`}
                  width={200}
                  height={200}
                  className="pdp-thumb"
                />
              ))}
            </div>
          ) : null}
        </section>

        <aside className="pdp-buybox">
          <div className="eyebrow">{product.vendor}</div>
          <h1 className="h2 pdp-title">{product.title}</h1>

          <div className="pdp-price">
            {onSale ? (
              <>
                <span className="pcard-was tnum">{formatPriceRange(compareMin, product.compareAtPriceRange.maxVariantPrice)}</span>
                <span className="pcard-now tnum" style={{ color: 'var(--sale)' }}>
                  {formatPriceRange(min, max)}
                </span>
              </>
            ) : (
              <span className="pcard-now tnum">{formatPriceRange(min, max)}</span>
            )}
          </div>

          <BuyBox options={product.options} variants={product.variants} />

          <ul className="pdp-trust">
            <li><Icon name="truck" size={16} /> Free white glove delivery</li>
            <li><Icon name="shield" size={16} /> 120-night comfort exchange</li>
            <li><Icon name="card" size={16} /> 0% APR financing available</li>
          </ul>
        </aside>
      </div>

      {product.descriptionHtml ? (
        <section className="section pdp-description">
          <div className="eyebrow">Details</div>
          <h2 className="h2">About this mattress</h2>
          <div className="rte" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
        </section>
      ) : null}

      <script id="ld-product" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <script id="ld-breadcrumb-product" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
