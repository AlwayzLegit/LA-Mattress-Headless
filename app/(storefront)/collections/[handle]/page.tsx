import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getCollectionByHandle } from '@/lib/shopify';
import { isMattressSubCategoryHandle } from '@/lib/collection-jsonld';
import { collections as inventoryCollections, findCollection } from '@/lib/inventory';
import { getCollectionSiblings } from '@/lib/collection-siblings';
import { capTitle, truncDescription, firstNonEmpty } from '@/lib/seo';
import { categoryIntroFor } from '@/lib/plp-content';
import { richTextJsonToHtml } from '@/lib/shopify/rich-text';
import { Icon } from '@/app/_components/icon';
import { PlpCard } from '@/app/_components/plp-card';
import { PlpCount } from '@/app/_components/plp-count';
import { PlpLoadMore } from '@/app/_components/plp-load-more';
import { PlpContentBlock } from '@/app/_components/plp-content-block';
import { TrackPlpView } from '@/app/_components/track-plp-view';
import { SortControl } from './sort-control';
import { SORT_OPTIONS } from './sort-options';
import { CollectionSkeleton } from './skeleton';
import { PlpParamResults } from './plp-param-results';
import {
  FilterPanel,
  FilterMobileTrigger,
  FilterShell,
  ActiveFilters,
} from '@/app/_components/plp-filters';

type Params = {
  params: Promise<{ handle: string }>;
};

// perf-isr-07 (Round 11 restructure): PLPs are static + ISR. This route
// renders ONLY the canonical param-less view (default sort, no filters) and
// never reads searchParams — reading them is what forced per-request
// rendering and the ~5s cold PLP renders SEMrush kept flagging (issue 111).
// Sort/filter/pagination variants are rendered client-side by
// <PlpParamResults> from /api/load-more-products; middleware stamps those
// URLs with `X-Robots-Tag: noindex` to keep the old per-request robots
// behavior. All snapshot collections prerender via generateStaticParams;
// unknown handles render on demand (dynamicParams default) and still 404
// through the sync CollectionBody path below.
export const revalidate = 300;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

const PER_PAGE = 24;

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  return inventoryCollections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Collection' };
  const collection = await getCollectionByHandle({ handle: params.handle, first: 1 }).catch(() => null);
  if (!collection) return { title: 'Collection not found' };
  // SEO is Shopify-owned (merchant edits collection.seo.* in Admin; the
  // SEMrush-tuned values were migrated there in the Phase 2 SEO-ownership
  // migration that retired lib/collection-seo-overrides.ts). capTitle /
  // truncDescription stay as render-time normalization + a safe fallback.
  const title = capTitle(
    firstNonEmpty(collection.seo.title, `${collection.title} | LA Mattress Store`),
  );
  const description = truncDescription(
    firstNonEmpty(
      collection.seo.description,
      collection.description,
      `Shop ${collection.title.toLowerCase()} at LA Mattress Store. Free white-glove delivery in Los Angeles.`,
    ),
  );
  const url = `/collections/${collection.handle}`;
  // Canonical is always the bare PLP URL. Query-string variants (`?sort=`,
  // `?vendor=`, `?after=`, legacy `?sort_by=` etc.) serve this same static
  // HTML with the grid swapped client-side; the per-request
  // `robots: noindex` that used to live here moved to middleware
  // (`X-Robots-Tag: noindex` on any /collections/* request with surviving
  // query params) because static metadata cannot see searchParams.
  return {
    title: { absolute: title },
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
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();

  // Hybrid: known handles in inventory snapshot use Suspense fast-path with
  // skeleton while an on-demand ISR render streams. Unknown handles fall
  // through to a synchronous fetch so bad URLs hit notFound() outside any
  // Suspense and emit a real HTTP 404. See app/products/[handle]/page.tsx
  // for the Phase 19 finding (notFound() inside Suspense returns 200, not 404).
  if (findCollection(params.handle)) {
    return (
      <Suspense fallback={<CollectionSkeleton />} key={params.handle}>
        <CollectionBody handle={params.handle} />
      </Suspense>
    );
  }
  return <CollectionBody handle={params.handle} />;
}

async function CollectionBody({ handle }: { handle: string }) {
  // Canonical view only: default sort, first page, no filters. Param'd
  // views never reach this server render — <PlpParamResults> swaps the
  // grid client-side from /api/load-more-products.
  const collection = await getCollectionByHandle({
    handle,
    first: PER_PAGE,
  }).catch(() => null);
  if (!collection) notFound();

  // Custom on-page H1 from the `custom.seo_h1` metafield (merchant-editable
  // in Admin), e.g. the size PLPs show "King Size Mattresses" while the
  // collection is named "King Mattresses". Falls back to the collection
  // title. Shopify source of truth (retired lib/collection-seo-overrides.ts).
  const h1Text = collection.seoH1 ?? collection.title;

  // Unfiltered total from the inventory snapshot. Shopify Storefront's
  // `products` connection doesn't return a total count, so this can drift
  // if a product is added or removed from the collection between snapshot
  // pulls — accurate enough for "Showing 24 of 169" UX, though.
  const totalInCollection = findCollection(handle)?.productsCount ?? null;

  const hasResults = collection.products.nodes.length > 0;
  const availableFilters = collection.products.filters ?? [];

  // Phase 284: cross-cut sub-nav. On a single-dimension PLP (a brand,
  // size, or type collection) surface the OTHER two dimensions so a
  // shopper can pivot to the high-intent intersection (e.g. from the
  // Tempur-Pedic PLP → Queen / King, or → Memory Foam / Hybrid).
  // Returns null on `mattresses`, `on-sale`, etc. → no sub-nav.
  const siblingGroups = getCollectionSiblings(collection.handle);

  // Analytics: what actually rendered above and below the grid?
  // Drives the v1 vs v2.1 layout-impact funnels in PostHog.
  const seoContentHtml = richTextJsonToHtml(collection.seoContentJson);
  const longHtml = seoContentHtml || collection.descriptionHtml || null;
  const introSource = collection.introShort ? 'metafield' : 'fallback';
  const longContentSource = seoContentHtml
    ? 'seo_content'
    : collection.descriptionHtml
      ? 'description_html'
      : 'none';

  return (
    <main className="container plp">
      <TrackPlpView
        handle={collection.handle}
        title={collection.title}
        layout="v2"
        introSource={introSource}
        longContentSource={longContentSource}
        productCount={collection.products.nodes.length}
      />
      <header className="plp-hero">
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          {/*
            Insert the Mattresses parent only when the collection is
            actually a mattress sub-category (handle ends in
            `-mattresses`). Bedding-accessory collections (pillows,
            sheets, mattress-toppers, etc.) and the root mattresses
            collection itself stay at 2 levels — they don't belong
            under /collections/mattresses in the natural hierarchy.
            Must match isMattressSubCategoryHandle() in
            lib/collection-jsonld.ts so the visible breadcrumb
            agrees with the JSON-LD BreadcrumbList.
          */}
          {isMattressSubCategoryHandle(collection.handle) ? (
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
            <h1 className="h-display plp-hero-title">{h1Text}.</h1>
            {/* PLP v2.1: above-the-grid hero lede is now sourced from
                the `custom.intro_short` collection metafield (Shopify-
                enforced 300-600 chars). When the metafield is empty (new
                collection, merchant hasn't filled it yet), fall back to
                the code template categoryIntroFor() so the hero is
                never blank. The long descriptionHtml moved below the
                product grid into <PlpContentBlock>. */}
            <p className="plp-hero-lede muted">
              {collection.introShort ?? categoryIntroFor(collection.handle, collection.title)}
            </p>
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
                // Explicit fetchPriority backs up the `priority` prop.
                // Next/Image is supposed to add fetchPriority="high"
                // automatically when priority is set, but PostHog web-
                // vitals showed /collections/adjustable-beds at LCP p75
                // 2.9s (poor) and similar tails on other collection
                // routes. Explicit hint is cheap and removes any
                // ambiguity from the browser's resource scheduler.
                fetchPriority="high"
              />
            </div>
          ) : null}
        </div>
      </header>

      {siblingGroups ? (
        <nav className="plp-sibling-nav" aria-label="Shop related collections">
          {siblingGroups.map((group) => (
            <div className="plp-sibling-group" key={group.heading}>
              <span className="plp-sibling-heading">{group.heading}</span>
              <ul className="plp-sibling-list">
                {group.links.map((link) => (
                  <li key={link.handle}>
                    <Link
                      href={`/collections/${link.handle}`}
                      className="plp-sibling-chip"
                      aria-current={link.handle === collection.handle ? 'page' : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      ) : null}

      <section className="section plp-section">
        <FilterShell>
          <div className="plp-layout">
            {/* Every client island below that reads useSearchParams gets
                its own tight <Suspense> boundary. On a static route,
                useSearchParams client-side-renders the tree up to the
                NEAREST boundary — without these, the bailout would climb
                to the page-level Suspense and the prerendered HTML would
                be a skeleton instead of the product grid (the whole point
                of the perf-isr-07 restructure). Fallbacks keep the layout
                slot; the real control hydrates in immediately. */}
            <Suspense fallback={<aside className="plp-filters" aria-hidden />}>
              <FilterPanel
                availableFilters={availableFilters}
                resultCount={totalInCollection ?? collection.products.nodes.length}
              />
            </Suspense>
            <div className="plp-main">
              <div className="plp-toolbar">
                <div className="plp-toolbar-left">
                  <Suspense fallback={null}>
                    <FilterMobileTrigger />
                  </Suspense>
                  {/* Phase 217: count display is a client island that
                      listens for `plp:count-rendered` events from
                      `PlpLoadMore` / `PlpParamResults` and re-renders
                      with the running total. Initial value is the
                      SSR-correct canonical count. */}
                  <PlpCount
                    initial={collection.products.nodes.length}
                    total={totalInCollection}
                    hasFiltersApplied={false}
                  />
                </div>
                <Suspense fallback={null}>
                  <SortControl
                    options={SORT_OPTIONS.map((o, i) => ({
                      value: `${o.value}${o.reverse ? '-r' : ''}`,
                      label: o.label,
                      index: i,
                    }))}
                  />
                </Suspense>
              </div>

              <Suspense fallback={null}>
                <ActiveFilters />
              </Suspense>

            {/* perf-isr-07: the server renders ONLY the canonical grid.
                <PlpParamResults> passes it through untouched when the URL
                has no sort/filter/cursor params, and swaps in a client-
                fetched grid (via /api/load-more-products) when it does.
                It deliberately avoids useSearchParams (event + popstate
                driven instead) so this whole subtree stays in the static
                HTML — see the component docblock. */}
            <PlpParamResults
              handle={collection.handle}
              initialCount={collection.products.nodes.length}
            >
              {hasResults ? (
                <>
                  <div className="plp-grid">
                    {collection.products.nodes.map((p, idx) => (
                      <PlpCard
                        key={p.id}
                        product={p}
                        // LCP candidates: first 4 cards of the SSR'd first
                        // page. At desktop widths (4-col grid via PLP CSS),
                        // the 4th card is in the first viewport row too —
                        // priority lets it skip the lazy-loading queue and
                        // hits the network in the first batch alongside
                        // the hero image. Subsequent pages (loaded by
                        // `PlpLoadMore` client-side append) pass
                        // `priority={false}`.
                        priority={idx < 4}
                      />
                    ))}
                  </div>
                  {/* Phase 217: client-side append replaces the previous
                      `<Link href={?after=cursor}>` full-page navigation.
                      Renders any client-loaded pages directly below the
                      SSR'd first page + a skeleton during fetch + the
                      Load More button. */}
                  <PlpLoadMore
                    collectionHandle={collection.handle}
                    sortParam={undefined}
                    filterQuery=""
                    initialCursor={collection.products.pageInfo.endCursor ?? null}
                    initialHasNext={collection.products.pageInfo.hasNextPage}
                    initialCount={collection.products.nodes.length}
                  />
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
            </PlpParamResults>
            </div>
          </div>
        </FilterShell>
      </section>

      <PlpContentBlock
        handle={collection.handle}
        title={collection.title}
        // PLP v2.1 Phase B: below-grid long-content priority computed
        // above as `longHtml` — seo_content → descriptionHtml → null.
        // PlpContentBlock omits the long-content section when null.
        descriptionHtml={longHtml}
      />

    </main>
  );
}
