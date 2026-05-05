import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

import { searchProducts } from '@/lib/shopify';
import { formatPriceRange } from '@/lib/format';
import { Icon } from '@/app/_components/icon';
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

type Params = { searchParams: Promise<Record<string, string | undefined>> };

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

const PER_PAGE = 24;

export const metadata: Metadata = {
  title: 'Search — LA Mattress Store',
  description: 'Search mattresses, adjustable beds, bedding, and more at LA Mattress Store.',
  robots: { index: false, follow: true },
};

export default async function SearchPage(props: Params) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? '').trim();
  const after = searchParams.after ?? null;
  const filterSel = parseFilterSelection(searchParams);
  const filters = selectionToProductFilters(filterSel);

  const result = q && SHOPIFY_CONFIGURED
    ? await searchProducts(q, { first: PER_PAGE, after, filters }).catch(() => null)
    : null;

  const products = result?.products ?? [];
  const totalCount = result?.totalCount ?? 0;
  const availableFilters = result?.filters ?? [];

  // Preserve q + filter params on pagination; only `after` advances.
  const buildNextHref = (cursor: string) => {
    const next = new URLSearchParams();
    next.set('q', q);
    for (const p of FILTER_PARAMS) {
      const v = searchParams[p];
      if (v) next.set(p, v);
    }
    next.set('after', cursor);
    return `/search?${next.toString()}`;
  };

  const nextHref = result?.pageInfo.hasNextPage && result.pageInfo.endCursor
    ? buildNextHref(result.pageInfo.endCursor)
    : null;

  return (
    <main className="container plp">
      <header className="lp-hero" style={{ paddingBottom: 'var(--s-5)' }}>
        <nav className="lp-breadcrumbs">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <span>Search</span>
        </nav>
        <div className="lp-hero-inner" style={{ marginTop: 'var(--s-5)' }}>
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
                    No matches for &ldquo;{q}&rdquo;
                    {filterSel ? ' with the current filters.' : '.'}{' '}
                    Try a different keyword, remove a filter, or{' '}
                    <Link href="/collections/mattresses" className="link-arrow">
                      browse mattresses <Icon name="arrow-right" size={14} />
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>
          </FilterShell>
        </section>
      )}
    </main>
  );
}
