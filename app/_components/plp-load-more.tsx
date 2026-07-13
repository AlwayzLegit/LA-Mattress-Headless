'use client';

import { useState, useTransition } from 'react';
import type { ProductSummary } from '@/lib/shopify';
import { Icon } from './icon';
import { PlpCard } from './plp-card';

/**
 * Client-side "Load more" controller for the PLP grid.
 *
 * Phase 217: replaces the previous `<Link href={?after=cursor}>`
 * full-page-navigation pattern. The link version made every
 * pagination click feel like a fresh page load — products disappeared,
 * skeleton flashed, scroll position jumped — which the user flagged
 * as "very weirdly" on the live deployment.
 *
 * Now: click "Load more" → fetch `/api/load-more-products` with the
 * current cursor + same sort/filter context as the SSR page → append
 * the returned products in place below the SSR'd first page, with
 * skeleton cards filling the gap during fetch.
 *
 * Dispatches a `plp:count-rendered` window CustomEvent on every
 * append with the cumulative rendered-product count, which `PlpCount`
 * (in the toolbar) listens for and re-renders against. Decoupling
 * the two via window events keeps the SSR'd toolbar structure intact
 * without threading React context across the page boundary.
 *
 * The component is rendered BELOW the SSR'd `<div className="plp-grid">`
 * containing the first page. Subsequent fetched pages render into
 * their own grids stacked below the first. CSS lays them out as one
 * continuous grid because all share `.plp-grid` styling.
 */
type Props = {
  collectionHandle: string;
  /** Same value the SSR page used for its sort (e.g. "PRICE-r"). */
  sortParam: string | undefined;
  /** Pre-built URLSearchParams string of filter params (vendor, type,
   * size, price, firmness, sleepPosition, heightRange) so the API
   * call shapes the same filter set as the SSR page. */
  filterQuery: string;
  initialCursor: string | null;
  initialHasNext: boolean;
  /** Number of products rendered in the SSR'd first page. Used as the
   * base for the running rendered-count event. */
  initialCount: number;
};

const PER_PAGE = 24;

export function PlpLoadMore({
  collectionHandle,
  sortParam,
  filterQuery,
  initialCursor,
  initialHasNext,
  initialCount,
}: Props) {
  const [pages, setPages] = useState<ProductSummary[][]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasNext);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const renderedCount = initialCount + pages.reduce((sum, p) => sum + p.length, 0);

  async function loadMore() {
    if (!cursor || !hasMore || isPending) return;
    setError(null);
    const params = new URLSearchParams(filterQuery);
    params.set('handle', collectionHandle);
    params.set('after', cursor);
    if (sortParam) params.set('sort', sortParam);

    try {
      const res = await fetch(`/api/load-more-products?${params.toString()}`, {
        // Same `cache-control` headers as the route emits — let the
        // browser HTTP cache handle dedupe for repeat back/forward.
        cache: 'default',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        products: ProductSummary[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };

      startTransition(() => {
        setPages((prev) => [...prev, data.products]);
        setCursor(data.pageInfo.endCursor);
        setHasMore(data.pageInfo.hasNextPage);
        // Notify <PlpCount> in the toolbar so it can re-render with
        // the new running total. Fires AFTER the state update so the
        // count text matches the visible card count.
        const nextRendered =
          initialCount + pages.reduce((sum, p) => sum + p.length, 0) + data.products.length;
        window.dispatchEvent(
          new CustomEvent('plp:count-rendered', { detail: nextRendered }),
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    }
  }

  return (
    <>
      {pages.map((products, pageIdx) => (
        <div key={pageIdx} className="plp-grid plp-grid-appended">
          {products.map((p) => (
            // Appended cards never carry priority — only the SSR'd
            // first-page cards (0, 1, 2) are LCP candidates.
            <PlpCard key={p.id} product={p} priority={false} />
          ))}
        </div>
      ))}

      {isPending ? (
        <div
          className="plp-grid plp-grid-appended"
          aria-busy="true"
          aria-label="Loading more products"
        >
          {Array.from({ length: Math.min(PER_PAGE, 8) }).map((_, i) => (
            <PlpCardSkeleton key={`skel-${i}`} />
          ))}
        </div>
      ) : null}

      <div className="plp-pagination">
        {error ? (
          <p className="muted" role="status" style={{ marginBottom: 'var(--s-3)' }}>
            Couldn&rsquo;t load more — please try again.
          </p>
        ) : null}
        {hasMore ? (
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={loadMore}
            disabled={isPending}
            aria-busy={isPending || undefined}
          >
            {isPending ? 'Loading…' : 'Load more'} <Icon name="arrow-right" size={16} />
          </button>
        ) : null}
      </div>
    </>
  );
}

/**
 * Skeleton card matching the visual + layout of `PlpCard` — image
 * placeholder + meta lines. Rendered during in-flight load-more fetch
 * so the user has immediate feedback that something's happening; far
 * better than a silent button or a spinner alone. Exported for
 * <PlpParamResults>, which shows the same skeletons while fetching a
 * sorted/filtered first page (perf-isr-07).
 */
export function PlpCardSkeleton() {
  return (
    <article className="pcard plp-card" aria-hidden="true">
      <div className="pcard-link">
        <div className="ph pcard-img skel" style={{ aspectRatio: '1' }}>&nbsp;</div>
        <div className="pcard-meta">
          <div className="skel skel-line" style={{ width: '40%', height: 12 }}>&nbsp;</div>
          <div className="skel skel-line" style={{ width: '85%', height: 16, marginTop: 8 }}>&nbsp;</div>
          <div className="skel skel-line" style={{ width: '60%', height: 14, marginTop: 12 }}>&nbsp;</div>
        </div>
      </div>
    </article>
  );
}
