import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

import { searchProducts, searchArticles } from '@/lib/shopify';
import type { ProductSummary, PredictiveArticle } from '@/lib/shopify';
import { formatPriceRange } from '@/lib/format';
import { formatPhone, searchShowrooms, type Showroom } from '@/lib/showrooms';
import { Icon } from '@/app/_components/icon';
import { CompareToggle } from '@/app/_components/compare-toggle';
import { PcardSpecs } from '@/app/_components/pcard-specs';
import { ReviewsBadge } from '@/app/_components/reviews-badge';
import {
  FilterPanel,
  FilterMobileTrigger,
  FilterShell,
  ActiveFilters,
  FILTER_PARAMS,
  parseFilterSelection,
  selectionToProductFilters,
} from '@/app/_components/plp-filters';
import { SearchInput } from './search-input';
import { TrackSearchView } from '@/app/_components/track-search-view';

type Params = { searchParams: Promise<Record<string, string | undefined>> };

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

const PER_PAGE = 24;

type Tab = 'all' | 'mattresses' | 'showrooms' | 'articles';
const TABS: { id: Tab; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'mattresses', label: 'Mattresses' },
  { id: 'showrooms',  label: 'Showrooms' },
  { id: 'articles',   label: 'Articles' },
];

const ALL_PREVIEW_PRODUCTS  = 6;
const ALL_PREVIEW_ARTICLES  = 4;
const ALL_PREVIEW_SHOWROOMS = 4;

function parseTab(raw: string | undefined): Tab {
  if (raw === 'articles') return 'articles';
  if (raw === 'showrooms') return 'showrooms';
  if (raw === 'mattresses') return 'mattresses';
  return 'all';
}

export const metadata: Metadata = {
  // `absolute` so the root layout's "%s · LA Mattress Store" template
  // can't append a second brand (QA: double-brand title).
  title: { absolute: 'Search · LA Mattress Store' },
  description: 'Search mattresses, adjustable beds, bedding, and more at LA Mattress Store.',
  robots: { index: false, follow: true },
  // Phase 258: /search is noindex but should still declare a clean
  // canonical pointing to the param-free URL. Without it, parameterized
  // permutations (?q=tempur&tab=mattresses&filter.size=Queen&sort=...)
  // each look like separate URLs to crawlers that respect canonical but
  // not noindex. The robots noindex covers Google; canonical covers
  // everyone else (SEMrush "Too many URL parameters" flag).
  alternates: { canonical: '/search' },
};

/**
 * /search results page — design handoff §search results, with the
 * full "All / Mattresses / Showrooms / Articles" tab pattern.
 *
 * - All (default): preview of the top results from each bucket stacked
 *   vertically with "View all N →" links to the dedicated tabs. Cheap —
 *   each bucket fires a small (first: 4-6) parallel fetch.
 * - Mattresses: the existing PLP-style filter rail + paginated grid.
 * - Showrooms: the in-process matches against the SHOWROOMS catalog,
 *   rendered as image-side cards (no API call).
 * - Articles: a gd-grid of article matches paginated independently.
 *
 * Tab counts on each bucket badge are real, sourced from the same
 * fetches that power the All-tab preview (so no duplicate cost on
 * the All tab).
 */
export default async function SearchPage(props: Params) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? '').trim();
  const tab = parseTab(searchParams.tab);
  const after = searchParams.after ?? null;
  const filterSel = parseFilterSelection(searchParams);
  const filters = selectionToProductFilters(filterSel);

  // Mattresses tab — full fetch (with filters) only on that tab.
  // All tab — small preview fetch (no filters) so each bucket has a
  // few results to show without overspending.
  const productResult =
    q && SHOPIFY_CONFIGURED && tab === 'mattresses'
      ? await searchProducts(q, { first: PER_PAGE, after, filters }).catch(() => null)
      : null;

  const allProductPreview =
    q && SHOPIFY_CONFIGURED && tab === 'all'
      ? await searchProducts(q, { first: ALL_PREVIEW_PRODUCTS }).catch(() => null)
      : null;

  // Articles tab — full fetch. All tab — small preview.
  const articleResult =
    q && SHOPIFY_CONFIGURED && tab === 'articles'
      ? await searchArticles(q, { first: PER_PAGE, after }).catch(() => null)
      : null;

  const allArticlePreview =
    q && SHOPIFY_CONFIGURED && tab === 'all'
      ? await searchArticles(q, { first: ALL_PREVIEW_ARTICLES }).catch(() => null)
      : null;

  // Showrooms catalog is 5 entries — search is in-process. Same matches
  // power tab counters and both All-tab and Showrooms-tab bodies.
  const showroomMatches = q ? searchShowrooms(q) : [];

  // Lightweight tab counters (totalCount only). When already on a
  // bucket-specific tab, reuse that fetch's totalCount; otherwise run
  // a 1-row count fetch in parallel so each tab badge is real without
  // a duplicate full query.
  const [otherProductCount, otherArticleCount] = q && SHOPIFY_CONFIGURED
    ? await Promise.all([
        tab === 'mattresses'
          ? Promise.resolve(productResult?.totalCount ?? 0)
          : tab === 'all'
          ? Promise.resolve(allProductPreview?.totalCount ?? 0)
          : searchProducts(q, { first: 1 }).then((r) => r.totalCount).catch(() => 0),
        tab === 'articles'
          ? Promise.resolve(articleResult?.totalCount ?? 0)
          : tab === 'all'
          ? Promise.resolve(allArticlePreview?.totalCount ?? 0)
          : searchArticles(q, { first: 1 }).then((r) => r.totalCount).catch(() => 0),
      ])
    : [0, 0];

  const tabCounts: Record<Tab, number> = {
    all:        otherProductCount + showroomMatches.length + otherArticleCount,
    mattresses: otherProductCount,
    showrooms:  showroomMatches.length,
    articles:   otherArticleCount,
  };

  const products = productResult?.products ?? [];
  const totalCount = productResult?.totalCount ?? 0;
  const availableFilters = productResult?.filters ?? [];

  const articles = articleResult?.articles ?? [];

  const buildTabHref = (next: Tab) => {
    const sp = new URLSearchParams();
    sp.set('q', q);
    if (next !== 'mattresses') sp.set('tab', next);
    return `/search?${sp.toString()}`;
  };

  const buildNextHref = (cursor: string) => {
    const next = new URLSearchParams();
    next.set('q', q);
    if (tab !== 'mattresses') next.set('tab', tab);
    if (tab === 'mattresses') {
      for (const p of FILTER_PARAMS) {
        const v = searchParams[p];
        if (v) next.set(p, v);
      }
    }
    next.set('after', cursor);
    return `/search?${next.toString()}`;
  };

  const productNextHref =
    tab === 'mattresses' && productResult?.pageInfo.hasNextPage && productResult.pageInfo.endCursor
      ? buildNextHref(productResult.pageInfo.endCursor)
      : null;

  const articleNextHref =
    tab === 'articles' && articleResult?.pageInfo.hasNextPage && articleResult.pageInfo.endCursor
      ? buildNextHref(articleResult.pageInfo.endCursor)
      : null;

  return (
    <main className="container plp">
      {q ? <TrackSearchView query={q} resultCount={tabCounts.all} /> : null}
      <header className="lp-hero" style={{ paddingBottom: 'var(--s-5)' }}>
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>Search</span>
        </nav>
        <div className="lp-hero-inner lp-hero-inner-stacked" style={{ marginTop: 'var(--s-5)' }}>
          <div className="lp-hero-copy">
            <div className="eyebrow">Search</div>
            <h1 className="h1">{q ? `Results for "${q}"` : 'What are you looking for?'}</h1>
            <SearchInput initialQuery={q} />
          </div>
        </div>
      </header>

      {!q ? (
        <section className="section">
          <p className="muted" style={{ maxWidth: '60ch', marginBottom: 'var(--s-5)' }}>
            Try searching for a brand (Tempur-Pedic, Stearns &amp; Foster), a size (queen, king),
            or a feature (cooling, adjustable) — or pick a category below.
          </p>
          <div className="nf-grid" style={{ marginTop: 0 }}>
            {[
              { label: 'Mattresses',         href: '/collections/mattresses',                sub: 'All sizes & brands' },
              { label: 'On Sale',            href: '/collections/on-sale',                   sub: 'Current markdowns' },
              { label: 'Tempur-Pedic',       href: '/collections/tempur-pedic-mattresses',   sub: 'Memory foam, premium' },
              { label: 'Stearns & Foster',   href: '/collections/stearns-foster-mattresses', sub: 'Luxury hybrids' },
              { label: 'Diamond Mattress',   href: '/collections/diamond-mattresses',        sub: 'California-made' },
              { label: 'Adjustable Bases',   href: '/collections/adjustable-beds',           sub: 'Pair with any mattress' },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="nf-tile">
                <div className="nf-tile-label">{c.label}</div>
                <div className="nf-tile-sub muted">{c.sub}</div>
                <Icon name="arrow-right" size={16} />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="section plp-section">
          <nav className="search-tabs" aria-label="Search categories">
            {TABS.map((t) => {
              const count = tabCounts[t.id];
              const isOn = tab === t.id;
              return (
                <Link
                  key={t.id}
                  href={buildTabHref(t.id)}
                  className={`search-tab${isOn ? ' is-on' : ''}`}
                  aria-current={isOn ? 'page' : undefined}
                >
                  <span>{t.label}</span>
                  <span className="search-tab-count tnum">{count}</span>
                </Link>
              );
            })}
          </nav>

          {tab === 'all' ? (
            <SearchAllTab
              q={q}
              products={allProductPreview?.products ?? []}
              productTotal={allProductPreview?.totalCount ?? 0}
              showrooms={showroomMatches.slice(0, ALL_PREVIEW_SHOWROOMS)}
              showroomTotal={showroomMatches.length}
              articles={allArticlePreview?.articles ?? []}
              articleTotal={allArticlePreview?.totalCount ?? 0}
              hrefMattresses={buildTabHref('mattresses')}
              hrefShowrooms={buildTabHref('showrooms')}
              hrefArticles={buildTabHref('articles')}
            />
          ) : tab === 'mattresses' ? (
            <FilterShell>
              <div className="plp-layout">
                <FilterPanel availableFilters={availableFilters} resultCount={products.length} />
                <div className="plp-main">
                  <div className="plp-toolbar">
                    <div className="plp-toolbar-left">
                      <FilterMobileTrigger sel={filterSel} />
                      <span className="plp-toolbar-count">
                        {products.length > 0
                          ? `${totalCount} result${totalCount === 1 ? '' : 's'}`
                          : 'No products match your filters'}
                      </span>
                    </div>
                  </div>

                  <ActiveFilters sel={filterSel} />

                  {products.length > 0 ? (
                    <>
                      <div className="plp-grid">
                        {products.map((p, idx) => (
                          // Article + sibling CompareToggle, see Phase 156
                          // comment in app/collections/[handle]/page.tsx.
                          <article key={p.id} className="pcard plp-card">
                            <Link href={`/products/${p.handle}`} className="pcard-link">
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
                                {p.reviews ? (
                                  <div className="pcard-reviews"><ReviewsBadge reviews={p.reviews} size="inline" /></div>
                                ) : null}
                                <PcardSpecs specs={p.specs} />
                                <div className="pcard-price">
                                  <span className="pcard-now tnum">
                                    {formatPriceRange(p.priceRange.minVariantPrice, p.priceRange.maxVariantPrice)}
                                  </span>
                                </div>
                              </div>
                            </Link>
                            <CompareToggle handle={p.handle} title={p.title} />
                          </article>
                        ))}
                      </div>
                      <div className="plp-pagination">
                        {productNextHref ? (
                          <Link href={productNextHref} className="btn btn-ghost btn-lg">
                            Load more <Icon name="arrow-right" size={16} />
                          </Link>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <NoMattressMatches q={q} hasFilters={Boolean(filterSel)} otherTab={otherArticleCount} qHref={buildTabHref('articles')} />
                  )}
                </div>
              </div>
            </FilterShell>
          ) : tab === 'showrooms' ? (
            <div className="plp-main" style={{ paddingTop: 'var(--s-5)' }}>
              <div className="plp-toolbar">
                <div className="plp-toolbar-left">
                  <span className="plp-toolbar-count">
                    {showroomMatches.length > 0
                      ? `${showroomMatches.length} showroom${showroomMatches.length === 1 ? '' : 's'}`
                      : 'No showrooms match'}
                  </span>
                </div>
              </div>

              {showroomMatches.length > 0 ? (
                <div className="search-showroom-grid">
                  {showroomMatches.map((s) => (
                    <Link key={s.handle} href={`/pages/${s.handle}`} className="search-showroom-card">
                      {s.imageUrl ? (
                        <div className="search-showroom-img">
                          <Image
                            src={s.imageUrl}
                            alt={s.name}
                            fill
                            sizes="(max-width: 760px) 100vw, 50vw"
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                      ) : <div className="search-showroom-img" aria-hidden="true" />}
                      <div className="search-showroom-body">
                        <div className="eyebrow">{s.area}</div>
                        <h3 className="search-showroom-name">{s.name}</h3>
                        <address className="search-showroom-addr muted">
                          {s.street}<br />
                          {s.city}, {s.region} {s.postalCode}
                        </address>
                        <div className="search-showroom-foot">
                          <span className="muted">{formatPhone(s.phone)}</span>
                          <span className="link-arrow">View <Icon name="arrow-right" size={14} /></span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="search-empty">
                  <p className="muted" style={{ fontSize: 16, lineHeight: 1.55, maxWidth: '60ch' }}>
                    No showrooms match &ldquo;{q}&rdquo;. Try a neighborhood (Koreatown, West LA,
                    La Brea, Studio City, Glendale) or a zip code.
                    {otherProductCount > 0 ? (
                      <> See <Link className="link-arrow" href={buildTabHref('mattresses')}>{otherProductCount} mattress result{otherProductCount === 1 ? '' : 's'}</Link> instead.</>
                    ) : null}
                  </p>
                  <p style={{ marginTop: 'var(--s-4)' }}>
                    <Link href="/pages/mattress-store-locations" className="link-arrow">
                      All five LA showrooms <Icon name="arrow-right" size={14} />
                    </Link>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="plp-main" style={{ paddingTop: 'var(--s-5)' }}>
              <div className="plp-toolbar">
                <div className="plp-toolbar-left">
                  <span className="plp-toolbar-count">
                    {articles.length > 0
                      ? `${articleResult?.totalCount ?? articles.length} article${articleResult?.totalCount === 1 ? '' : 's'}`
                      : 'No articles match'}
                  </span>
                </div>
              </div>

              {articles.length > 0 ? (
                <>
                  <div className="gd-grid">
                    {articles.map((a, idx) => {
                      const dateLabel = new Date(a.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      });
                      return (
                        <Link
                          key={a.id}
                          href={`/blogs/${a.blog.handle}/${a.handle}`}
                          className="gd-card"
                        >
                          <div className="gd-card-img">
                            {a.image ? (
                              <Image
                                src={a.image.url}
                                alt={a.image.altText ?? a.title}
                                fill
                                sizes="(max-width: 760px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                style={{ objectFit: 'cover' }}
                                priority={!after && idx < 3}
                              />
                            ) : (
                              <span className="ph-label" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                                [Article image]
                              </span>
                            )}
                          </div>
                          <div className="gd-card-body">
                            <div className="gd-card-meta">
                              <span>{a.blog.title}</span>
                              <span aria-hidden="true">·</span>
                              <time dateTime={a.publishedAt}>{dateLabel}</time>
                            </div>
                            <h3>{a.title}</h3>
                            {a.excerpt ? <p className="gd-card-excerpt">{a.excerpt}</p> : null}
                            <div className="gd-card-foot">
                              <span className="muted">LA Mattress</span>
                              <span className="arrow">
                                Read <Icon name="arrow-right" size={14} />
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {articleNextHref ? (
                    <div className="plp-pagination" style={{ marginTop: 'var(--s-7)' }}>
                      <Link href={articleNextHref} className="btn btn-ghost btn-lg">
                        Load more <Icon name="arrow-right" size={16} />
                      </Link>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="search-empty">
                  <p className="muted" style={{ fontSize: 16, lineHeight: 1.55, maxWidth: '60ch' }}>
                    No articles match &ldquo;{q}&rdquo;.
                    {otherProductCount > 0 ? (
                      <> See <Link className="link-arrow" href={buildTabHref('mattresses')}>{otherProductCount} mattress result{otherProductCount === 1 ? '' : 's'}</Link> instead.</>
                    ) : null}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function NoMattressMatches({
  q,
  hasFilters,
  otherTab,
  qHref,
}: {
  q: string;
  hasFilters: boolean;
  otherTab: number;
  qHref: string;
}) {
  return (
    <div className="search-empty">
      <p className="muted" style={{ fontSize: 16, lineHeight: 1.55, maxWidth: '60ch' }}>
        No mattresses match &ldquo;{q}&rdquo;
        {hasFilters ? ' with the current filters.' : '.'}{' '}
        {otherTab > 0 ? (
          <>See <Link className="link-arrow" href={qHref}>{otherTab} article result{otherTab === 1 ? '' : 's'}</Link>, or try one of these:</>
        ) : (
          'Try one of these instead:'
        )}
      </p>
      <div className="search-empty-grid">
        <Link href="/collections/mattresses" className="search-empty-tile">
          <div className="search-empty-tile-label">All mattresses</div>
          <div className="search-empty-tile-sub muted">Every brand, every size</div>
          <Icon name="arrow-right" size={16} />
        </Link>
        <Link href="/collections/tempur-pedic-mattresses" className="search-empty-tile">
          <div className="search-empty-tile-label">Tempur-Pedic</div>
          <div className="search-empty-tile-sub muted">Memory foam, premium</div>
          <Icon name="arrow-right" size={16} />
        </Link>
        <Link href="/collections/stearns-foster-mattresses" className="search-empty-tile">
          <div className="search-empty-tile-label">Stearns &amp; Foster</div>
          <div className="search-empty-tile-sub muted">Luxury hybrids</div>
          <Icon name="arrow-right" size={16} />
        </Link>
        <Link href="/collections/on-sale" className="search-empty-tile">
          <div className="search-empty-tile-label">On sale</div>
          <div className="search-empty-tile-sub muted">Current markdowns</div>
          <Icon name="arrow-right" size={16} />
        </Link>
        <Link href="/sleep-quiz" className="search-empty-tile">
          <div className="search-empty-tile-label">Take the sleep quiz</div>
          <div className="search-empty-tile-sub muted">Get a personal match</div>
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}

/**
 * "All" tab body — design handoff §search-results · default tab.
 *
 * Shows up to N from each bucket (Mattresses / Showrooms / Articles)
 * stacked vertically. Each bucket has a head with a "View all N →"
 * link to its dedicated tab. Empty buckets hide entirely. If every
 * bucket is empty, the same recovery grid as the other tabs renders.
 *
 * The previews come from cheap counted fetches in the parent server
 * component — `searchProducts(q, { first: 6 })` and
 * `searchArticles(q, { first: 4 })` — so the All tab cost is a single
 * extra round-trip per bucket, not a full page.
 */
function SearchAllTab({
  q,
  products,
  productTotal,
  showrooms,
  showroomTotal,
  articles,
  articleTotal,
  hrefMattresses,
  hrefShowrooms,
  hrefArticles,
}: {
  q: string;
  products: ProductSummary[];
  productTotal: number;
  showrooms: Showroom[];
  showroomTotal: number;
  articles: PredictiveArticle[];
  articleTotal: number;
  hrefMattresses: string;
  hrefShowrooms: string;
  hrefArticles: string;
}) {
  const isEmpty = products.length === 0 && showrooms.length === 0 && articles.length === 0;

  if (isEmpty) {
    return (
      <div className="search-empty">
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.55, maxWidth: '60ch' }}>
          No matches for &ldquo;{q}&rdquo;. Try a brand (Tempur-Pedic, Helix), a feature (cooling, firm),
          or a neighborhood.
        </p>
        <div className="search-empty-grid">
          <Link href="/collections/mattresses" className="search-empty-tile">
            <div className="search-empty-tile-label">All mattresses</div>
            <div className="search-empty-tile-sub muted">Every brand, every size</div>
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/sleep-quiz" className="search-empty-tile">
            <div className="search-empty-tile-label">Take the sleep quiz</div>
            <div className="search-empty-tile-sub muted">Get a personal match</div>
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/pages/mattress-store-locations" className="search-empty-tile">
            <div className="search-empty-tile-label">All five LA showrooms</div>
            <div className="search-empty-tile-sub muted">Try in person</div>
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="search-all">
      {products.length > 0 ? (
        <section className="search-all-bucket">
          <div className="search-all-head">
            <h2 className="h2">Mattresses</h2>
            <Link href={hrefMattresses} className="link-arrow">
              View all {productTotal} <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <div className="plp-grid">
            {products.map((p, idx) => (
              // Article + sibling CompareToggle, see Phase 156 comment
              // in app/collections/[handle]/page.tsx.
              <article key={p.id} className="pcard plp-card">
                <Link href={`/products/${p.handle}`} className="pcard-link">
                  <div className="ph pcard-img" style={{ aspectRatio: '1' }}>
                    {p.featuredImage ? (
                      <Image
                        src={p.featuredImage.url}
                        alt={p.featuredImage.altText ?? p.title}
                        width={600}
                        height={600}
                        sizes="(max-width: 760px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                        loading={idx < 3 ? 'eager' : 'lazy'}
                      />
                    ) : <span className="ph-label">[Image coming]</span>}
                  </div>
                  <div className="pcard-meta">
                    <div className="pcard-brand">{p.vendor}</div>
                    <div className="pcard-name">{p.title}</div>
                    {p.reviews ? (
                      <div className="pcard-reviews"><ReviewsBadge reviews={p.reviews} size="inline" /></div>
                    ) : null}
                    <PcardSpecs specs={p.specs} />
                    <div className="pcard-price">
                      <span className="pcard-now tnum">
                        {formatPriceRange(p.priceRange.minVariantPrice, p.priceRange.maxVariantPrice)}
                      </span>
                    </div>
                  </div>
                </Link>
                <CompareToggle handle={p.handle} title={p.title} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showrooms.length > 0 ? (
        <section className="search-all-bucket">
          <div className="search-all-head">
            <h2 className="h2">Showrooms</h2>
            <Link href={hrefShowrooms} className="link-arrow">
              View all {showroomTotal} <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <div className="search-showroom-grid">
            {showrooms.map((s) => (
              <Link key={s.handle} href={`/pages/${s.handle}`} className="search-showroom-card">
                {s.imageUrl ? (
                  <div className="search-showroom-img">
                    <Image
                      src={s.imageUrl}
                      alt={s.name}
                      fill
                      sizes="(max-width: 760px) 100vw, 50vw"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                ) : <div className="search-showroom-img" aria-hidden="true" />}
                <div className="search-showroom-body">
                  <div className="eyebrow">{s.area}</div>
                  <h3 className="search-showroom-name">{s.name}</h3>
                  <address className="search-showroom-addr muted">
                    {s.street}<br />
                    {s.city}, {s.region} {s.postalCode}
                  </address>
                  <div className="search-showroom-foot">
                    <span className="muted">{formatPhone(s.phone)}</span>
                    <span className="link-arrow">View <Icon name="arrow-right" size={14} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {articles.length > 0 ? (
        <section className="search-all-bucket">
          <div className="search-all-head">
            <h2 className="h2">Articles</h2>
            <Link href={hrefArticles} className="link-arrow">
              View all {articleTotal} <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <div className="gd-grid">
            {articles.map((a) => {
              const dateLabel = new Date(a.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              });
              return (
                <Link key={a.id} href={`/blogs/${a.blog.handle}/${a.handle}`} className="gd-card">
                  <div className="gd-card-img">
                    {a.image ? (
                      <Image
                        src={a.image.url}
                        alt={a.image.altText ?? a.title}
                        fill
                        sizes="(max-width: 760px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <span className="ph-label" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                        [Article image]
                      </span>
                    )}
                  </div>
                  <div className="gd-card-body">
                    <div className="gd-card-meta">
                      <span>{a.blog.title}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={a.publishedAt}>{dateLabel}</time>
                    </div>
                    <h3>{a.title}</h3>
                    {a.excerpt ? <p className="gd-card-excerpt">{a.excerpt}</p> : null}
                    <div className="gd-card-foot">
                      <span className="muted">LA Mattress</span>
                      <span className="arrow">Read <Icon name="arrow-right" size={14} /></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
