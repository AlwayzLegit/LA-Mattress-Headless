import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

import { getCollectionByHandle } from '@/lib/shopify';
import { collections as inventoryCollections } from '@/lib/inventory';
import { formatPriceRange } from '@/lib/format';
import { Icon } from '@/app/_components/icon';

type Params = { params: { handle: string } };

export const revalidate = 600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  // Build every collection in the inventory snapshot. There are only ~60.
  return inventoryCollections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!SHOPIFY_CONFIGURED) return { title: 'Collection' };
  const collection = await getCollectionByHandle({ handle: params.handle, first: 1 }).catch(() => null);
  if (!collection) return { title: 'Collection not found' };
  const title = collection.seo.title ?? `${collection.title} | LA Mattress Store`;
  const fallbackDesc = collection.description.length > 160
    ? `${collection.description.slice(0, 157)}...`
    : collection.description;
  const description =
    collection.seo.description
      ?? (fallbackDesc || `Shop ${collection.title.toLowerCase()} at LA Mattress Store. Free white glove delivery in Los Angeles.`);
  const url = `/collections/${collection.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, images: collection.image ? [{ url: collection.image.url }] : [] },
  };
}

export default async function CollectionPage({ params }: Params) {
  if (!SHOPIFY_CONFIGURED) notFound();
  const collection = await getCollectionByHandle({ handle: params.handle, first: 24 }).catch(() => null);
  if (!collection) notFound();

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://mattressstoreslosangeles.com/' },
      { '@type': 'ListItem', position: 2, name: collection.title },
    ],
  };

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    description: collection.seo.description ?? collection.description ?? undefined,
    url: `https://mattressstoreslosangeles.com/collections/${collection.handle}`,
  };

  return (
    <main className="container plp">
      <header className="lp-hero">
        <nav className="lp-breadcrumbs">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href="/collections/mattresses">Shop</Link>
          <span className="sep">/</span>
          <span>{collection.title}</span>
        </nav>
        <div className="lp-hero-inner" style={{ marginTop: 'var(--s-5)' }}>
          <div className="lp-hero-copy">
            <h1 className="h1">{collection.title}</h1>
            {collection.descriptionHtml ? (
              <div className="lp-hero-lede rte" dangerouslySetInnerHTML={{ __html: collection.descriptionHtml }} />
            ) : null}
            <div className="lp-hero-meta">
              <span><strong>{collection.products.nodes.length}</strong> shown</span>
              <span><Icon name="truck" size={14} /> Free delivery</span>
              <span><Icon name="shield" size={14} /> 120-night exchange</span>
            </div>
          </div>
        </div>
      </header>

      {collection.products.nodes.length === 0 ? (
        <section className="section">
          <p className="muted">No products in this collection yet. <Link href="/collections/mattresses" className="link-arrow">Browse all mattresses <Icon name="arrow-right" size={14} /></Link></p>
        </section>
      ) : (
        <section className="section">
          <div className="plp-grid">
            {collection.products.nodes.map((p) => (
              <Link key={p.id} href={`/products/${p.handle}`} className="pcard plp-card">
                <div className="ph pcard-img" style={{ aspectRatio: '1' }}>
                  {p.featuredImage ? (
                    <Image
                      src={p.featuredImage.url}
                      alt={p.featuredImage.altText ?? p.title}
                      width={600}
                      height={600}
                      sizes="(max-width: 760px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                    />
                  ) : <span className="ph-label">[Image coming]</span>}
                </div>
                <div className="pcard-meta">
                  <div className="pcard-brand">{p.vendor}</div>
                  <div className="pcard-name">{p.title}</div>
                  <div className="pcard-price">
                    <span className="pcard-now tnum">
                      {formatPriceRange(p.priceRange.minVariantPrice, p.priceRange.maxVariantPrice)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {collection.products.pageInfo.hasNextPage ? (
            <p className="muted" style={{ marginTop: 'var(--s-5)' }}>
              Showing first 24 products. Pagination wired in next iteration.
            </p>
          ) : null}
        </section>
      )}

      <Script id="ld-collection" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <Script id="ld-breadcrumb-collection" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
