import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getCollectionByHandle } from '@/lib/shopify';
import type { CollectionSort } from '@/lib/shopify';
import { collections as inventoryCollections, findCollection } from '@/lib/inventory';
import { formatPriceRange } from '@/lib/format';
import { capTitle, truncDescription, firstNonEmpty } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { Icon } from '@/app/_components/icon';
import { CompareToggle } from '@/app/_components/compare-toggle';
import { PcardSpecs } from '@/app/_components/pcard-specs';
import { SortControl } from './sort-control';
import { CollectionSkeleton } from './skeleton';
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
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

// PLP depends on searchParams (sort, after, filters) — must be dynamic per request.
// The Storefront `getCollectionByHandle` fetch is cached by URL on Next's data layer.
export const dynamic = 'force-dynamic';

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

export async function generateMetadata(props: { params: Promise<Params['params']> }): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Collection' };
  const collection = await getCollectionByHandle({ handle: params.handle, first: 1 }).catch(() => null);
  if (!collection) return { title: 'Collection not found' };
  const title = capTitle(firstNonEmpty(collection.seo.title, `${collection.title} | LA Mattress Store`));
  const description = truncDescription(
    firstNonEmpty(
      collection.seo.description,
      collection.description,
      `Shop ${collection.title.toLowerCase()} at LA Mattress Store. Free white-glove delivery in Los Angeles.`,
    ),
  );
  const url = `/collections/${collection.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Per Next.js metadata rules: a route declaring its own `openGraph`
    // object replaces the parent layout's wholesale, and the file-system
    // OG image convention (`app/opengraph-image.tsx`) is NOT auto-merged
    // unless the route's `openGraph.images` is absent. Routes that omit
    // images would still emit no og:image. Reference the convention
    // explicitly as a fallback so coverless collections still serve the
    // brand OG card. (Width / height match Next.js's auto-emitted
    // dimensions for `opengraph-image.tsx`.)
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: collection.image
        ? [{ url: collection.image.url }]
        : [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
  };
}

export default async function CollectionPage(props: Params) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();

  // Hybrid: known handles in inventory snapshot use Suspense fast-path with
  // skeleton on filter/sort/page changes. Unknown handles fall through to a
  // synchronous fetch so bad URLs hit notFound() outside any Suspense and
  // emit a real HTTP 404. See app/products/[handle]/page.tsx for the
  // Phase 19 finding (notFound() inside Suspense returns 200, not 404).
  if (findCollection(params.handle)) {
    const suspenseKey = `${params.handle}|${searchParams.sort ?? ''}|${searchParams.after ?? ''}|${FILTER_PARAMS.map((p) => searchParams[p] ?? '').join('|')}`;
    return (
      <Suspense fallback={<CollectionSkeleton />} key={suspenseKey}>
        <CollectionBody handle={params.handle} searchParams={searchParams} />
      </Suspense>
    );
  }
  return <CollectionBody handle={params.handle} searchParams={searchParams} />;
}

async function CollectionBody({ handle, searchParams }: { handle: string; searchParams: Record<string, string | undefined> }) {
  const { sortKey, reverse, index: sortIndex } = parseSort(searchParams.sort);
  const after = searchParams.after ?? null;
  const filterSel = parseFilterSelection(searchParams);
  const filters = selectionToProductFilters(filterSel);
  const collection = await getCollectionByHandle({
    handle,
    first: PER_PAGE,
    after,
    sortKey,
    reverse,
    filters,
  }).catch(() => null);
  if (!collection) notFound();

  // Unfiltered total from the inventory snapshot. Shopify Storefront's
  // `products` connection doesn't return a total count, so this can drift
  // if a product is added or removed from the collection between snapshot
  // pulls — accurate enough for "Showing 24 of 169" UX, though.
  const totalInCollection = findCollection(handle)?.productsCount ?? null;
  const filterCount =
    Object.values(filterSel).filter((v) => Array.isArray(v) ? v.length > 0 : v != null).length;
  const hasFiltersApplied = filterCount > 0;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://mattressstoreslosangeles.com/' },
      { '@type': 'ListItem', position: 2, name: collection.title, item: `https://mattressstoreslosangeles.com/collections/${collection.handle}` },
    ],
  };

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    description: firstNonEmpty(collection.seo.description, collection.description) || undefined,
    url: `https://mattressstoreslosangeles.com/collections/${collection.handle}`,
    inLanguage: 'en-US',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: collection.products.nodes.length,
      itemListElement: collection.products.nodes.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://mattressstoreslosangeles.com/products/${p.handle}`,
        name: p.title,
      })),
    },
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
      <header className="plp-hero">
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          {collection.handle !== 'mattresses' ? (
            <>
              <Link href="/collections/mattresses">Mattresses</Link>
              <span className="sep" aria-hidden="true">/</span>
            </>
          ) : null}
          <span>{collection.title}</span>
        </nav>
        <div className="plp-hero-inner">
          <div className="plp-hero-copy">
            <div className="eyebrow">All mattresses</div>
            <h1 className="h-display plp-hero-title">{collection.title}.</h1>
            {collection.descriptionHtml ? (
              <div className="plp-hero-lede muted rte" dangerouslySetInnerHTML={{ __html: sanitizeShopifyHtml(collection.descriptionHtml) }} />
            ) : (
              <p className="plp-hero-lede muted">
                Every model on this page is on the floor at one of our 5 LA showrooms — try before you buy.
                Free white-glove delivery, 120-night exchange, 0% APR financing.
              </p>
            )}
          </div>
          {collection.image ? (
            <div className="plp-hero-img">
              <Image
                src={collection.image.url}
                alt={collection.image.altText ?? collection.title}
                width={800}
                height={500}
                sizes="(max-width: 900px) 100vw, 600px"
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                priority
              />
            </div>
          ) : null}
        </div>
      </header>

      <section className="section plp-section">
        <FilterShell>
          <div className="plp-layout">
            <FilterPanel
              availableFilters={availableFilters}
              resultCount={hasFiltersApplied ? collection.products.nodes.length : (totalInCollection ?? collection.products.nodes.length)}
            />
            <div className="plp-main">
              <div className="plp-toolbar">
                <div className="plp-toolbar-left">
                  <FilterMobileTrigger sel={filterSel} />
                  <span className="plp-toolbar-count">
                    {!hasResults
                      ? 'No products match your filters'
                      : after
                      ? `Showing ${collection.products.nodes.length} more product${collection.products.nodes.length === 1 ? '' : 's'}`
                      : hasFiltersApplied || !totalInCollection
                      ? `Showing ${collection.products.nodes.length} product${collection.products.nodes.length === 1 ? '' : 's'}`
                      : `Showing ${collection.products.nodes.length} of ${totalInCollection} product${totalInCollection === 1 ? '' : 's'}`}
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
                  {collection.products.nodes.map((p, idx) => {
                    const minPrice = Number.parseFloat(p.priceRange.minVariantPrice.amount);
                    const minCompare = Number.parseFloat(p.compareAtPriceRange.minVariantPrice.amount);
                    const onSale = minCompare > 0 && minCompare > minPrice;
                    const pctOff = onSale ? Math.round((1 - minPrice / minCompare) * 100) : 0;
                    return (
                    // Article wraps the link + the CompareToggle as
                    // siblings. Previously the Compare <button> sat
                    // inside the <Link>, which is HTML5-invalid (a >
                    // button) and creates ergonomics weirdness even
                    // when stopPropagation cancels the bubble. The
                    // article now carries the .pcard / .plp-card
                    // visual styles; the inner .pcard-link is a flat
                    // flex-column for image + meta only.
                    <article key={p.id} className="pcard plp-card">
                      <Link href={`/products/${p.handle}`} className="pcard-link">
                        <div className="ph pcard-img" style={{ aspectRatio: '1' }}>
                          {onSale ? (
                            <span className="pcard-tag pcard-tag-sale">−{pctOff}%</span>
                          ) : null}
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
                          <PcardSpecs specs={p.specs} />
                          <div className="pcard-price">
                            {onSale ? (
                              <span className="pcard-was tnum">
                                {formatPriceRange(p.compareAtPriceRange.minVariantPrice, p.compareAtPriceRange.maxVariantPrice)}
                              </span>
                            ) : null}
                            <span className="pcard-now tnum">
                              {formatPriceRange(p.priceRange.minVariantPrice, p.priceRange.maxVariantPrice)}
                            </span>
                          </div>
                        </div>
                      </Link>
                      <CompareToggle handle={p.handle} title={p.title} />
                    </article>
                    );
                  })}
                </div>
                <div className="plp-pagination">
                  {nextHref ? (
                    <Link
                      href={nextHref}
                      className="btn btn-ghost btn-lg"
                      aria-label={`Load more ${collection.title.toLowerCase()}`}
                    >
                      Load more <Icon name="arrow-right" size={16} />
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="plp-empty">
                <div className="plp-empty-mark"><Icon name="search" size={28} /></div>
                <h3 className="h3">No mattresses match these filters.</h3>
                <p className="muted">Try removing a filter or clearing them all to see more results.</p>
                <Link href={`/collections/${collection.handle}`} className="btn btn-primary">
                  Clear all filters
                </Link>
              </div>
            )}
            </div>
          </div>
        </FilterShell>
      </section>

      <script id="ld-collection" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <script id="ld-breadcrumb-collection" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
