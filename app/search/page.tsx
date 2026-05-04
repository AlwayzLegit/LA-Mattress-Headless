import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

import { searchProducts } from '@/lib/shopify';
import { formatPriceRange } from '@/lib/format';
import { Icon } from '@/app/_components/icon';
import { SearchInput } from './search-input';

type Params = { searchParams: { q?: string; after?: string } };

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);

const PER_PAGE = 24;

export const metadata: Metadata = {
  title: 'Search — LA Mattress Store',
  description: 'Search mattresses, adjustable beds, bedding, and more at LA Mattress Store.',
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: Params) {
  const q = (searchParams.q ?? '').trim();
  const after = searchParams.after ?? null;

  const result = q && SHOPIFY_CONFIGURED
    ? await searchProducts(q, { first: PER_PAGE, after }).catch(() => null)
    : null;

  const products = result?.products ?? [];
  const totalCount = result?.totalCount ?? 0;

  const nextHref = result?.pageInfo.hasNextPage && result.pageInfo.endCursor
    ? `/search?${new URLSearchParams({ q, after: result.pageInfo.endCursor }).toString()}`
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
          <p className="muted" style={{ maxWidth: '60ch' }}>
            Try searching for a brand (Tempur-Pedic, Stearns &amp; Foster), a size (queen, king),
            or a feature (cooling, adjustable). You can also{' '}
            <Link href="/collections/mattresses" className="link-arrow">
              browse all mattresses <Icon name="arrow-right" size={14} />
            </Link>.
          </p>
        </section>
      ) : products.length === 0 ? (
        <section className="section">
          <p className="muted" style={{ maxWidth: '60ch' }}>
            No matches for &ldquo;{q}&rdquo;. Try a different keyword, or{' '}
            <Link href="/collections/mattresses" className="link-arrow">
              browse mattresses <Icon name="arrow-right" size={14} />
            </Link>.
          </p>
        </section>
      ) : (
        <section className="section">
          <div className="plp-toolbar">
            <span className="plp-toolbar-count">
              {totalCount} result{totalCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="plp-grid">
            {products.map((p) => (
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
          <div className="plp-pagination">
            {nextHref ? (
              <Link href={nextHref} className="btn btn-ghost btn-lg">
                Load more <Icon name="arrow-right" size={16} />
              </Link>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
