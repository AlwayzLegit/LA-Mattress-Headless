import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

import { getCollectionByHandle } from '@/lib/shopify';
import type { CollectionSort } from '@/lib/shopify';
import { collections as inventoryCollections } from '@/lib/inventory';
import { formatPriceRange } from '@/lib/format';
import { Icon } from '@/app/_components/icon';
import { SortControl } from './sort-control';
import {
  FilterPanel,
  FilterMobileTrigger,
  FilterShell,
  ActiveFilters,
  FILTER_PARAMS,
  parseFilterSelection,
  selectionToProductFilters,
} from '@/app/_components/plp-filters';

type Params = {
  params: { handle: string };
  searchParams: Record<string, string | undefined>;
};

export const revalidate = 600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

const PER_PAGE = 24;

const SORT_OPTIONS: { value: CollectionSort; label: string; reverse?: boolean }[] = [
  { value: 'COLLECTION_DEFAULT', label: 'Featured' },
  { value: 'PRICE',              label: 'Price: low to high' },
  { value: 'PRICE',              label: 'Price: high to low', reverse: true },
  { value: 'BEST_SELLING',       label: 'Best selling' },
  { value: 'CREATED',            label: 'Newest', reverse: true },
];

function parseSort(raw: string | undefined): { sortKey: CollectionSort; reverse: boolean; index: number } {
  const idx = SORT_OPTIONS.findIndex((o) => `${o.value}${o.reverse ? '-r' : ''}` === raw);
  const i = idx >= 0 ? idx : 0;
  const opt = SORT_OPTIONS[i];
  return { sortKey: opt.value, reverse: opt.reverse ?? false, index: i };
}

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  return inventoryCollections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: { params: Params['params'] }): Promise<Metadata> {
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

export default async function CollectionPage({ params, searchParams }: Params) {
  if (!SHOPIFY_CONFIGURED) notFound();
  const { sortKey, reverse, index: sortIndex } = parseSort(searchParams.sort);
  const after = searchParams.after ?? null;
  const filterSel = parseFilterSelection(searchParams);
  const filters = selectionToProductFilters(filterSel);
  const collection = await getCollectionByHandle({
    handle: params.handle,
    first: PER_PAGE,
    after,
    sortKey,
    reverse,
    filters,
  }).catch(() => null);
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

  // Preserve sort + filter params when paginating; only `after` advances.
  const buildNextHref = (cursor: string) => {
    const next = new URLSearchParams();
    if (searchParams.sort) next.set('sort', searchParams.sort);
    for (const p of FILTER_PARAMS) {
      const v = searchParams[p];
      if (v) next.set(p, v);
    }
    next.set('after', cursor);
    return `/collections/${collection.handle}?${next.toString()}`;
  };

  const nextHref =
    collection.products.pageInfo.hasNextPage && collection.products.pageInfo.endCursor
      ? buildNextHref(collection.products.pageInfo.endCursor)
      : null;

  const hasResults = collection.products.nodes.length > 0;
  const availableFilters = collection.products.filters ?? [];

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
              <span><Icon name="truck" size={14} /> Free delivery</span>
              <span><Icon name="shield" size={14} /> 120-night exchange</span>
              <span><Icon name="card" size={14} /> 0% APR financing</span>
            </div>
          </div>
        </div>
      </header>

      <section className="section plp-section">
        <FilterShell>
          <div className="plp-layout">
            <FilterPanel availableFilters={availableFilters} />
            <div className="plp-main">
              <div className="plp-toolbar">
                <div className="plp-toolbar-left">
                  <FilterMobileTrigger sel={filterSel} />
                  <span className="plp-toolbar-count">
                    {hasResults
                      ? `Showing ${collection.products.nodes.length} ${after ? 'more ' : ''}product${collection.products.nodes.length === 1 ? '' : 's'}`
                      : 'No products match your filters'}
                  </span>
                </div>
                <SortControl
                  options={SORT_OPTIONS.map((o, i) => ({
                    value: `${o.value}${o.reverse ? '-r' : ''}`,
                    label: o.label,
                    index: i,
                  }))}
                  currentIndex={sortIndex}
                />
              </div>

              <ActiveFilters sel={filterSel} />

            {hasResults ? (
              <>
                <div className="plp-grid">
                  {collection.products.nodes.map((p, idx) => (
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
                            priority={!after && idx < 3}
                            loading={!after && idx < 3 ? 'eager' : 'lazy'}
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
                <div className="plp-pagination">
                  {nextHref ? (
                    <Link href={nextHref} className="btn btn-ghost btn-lg">
                      Load more <Icon name="arrow-right" size={16} />
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="muted" style={{ marginTop: 'var(--s-5)' }}>
                Try removing a filter, or{' '}
                <Link href={`/collections/${collection.handle}`} className="link-arrow">
                  reset filters <Icon name="arrow-right" size={14} />
                </Link>
                .
              </p>
            )}
            </div>
          </div>
        </FilterShell>
      </section>

      <Script id="ld-collection" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <Script id="ld-breadcrumb-collection" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
