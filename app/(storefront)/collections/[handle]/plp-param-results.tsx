'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { ProductSummary } from '@/lib/shopify';
import { Icon } from '@/app/_components/icon';
import { PlpCard } from '@/app/_components/plp-card';
import { PlpLoadMore, PlpCardSkeleton } from '@/app/_components/plp-load-more';
import { FILTER_PARAMS, PLP_PARAMS_CHANGED_EVENT } from '@/app/_components/plp-filters';

/**
 * perf-isr-07 (Round 11): client boundary that makes the static PLP serve
 * sorted / filtered / paginated views.
 *
 * The /collections/[handle] route is static + ISR and renders ONLY the
 * canonical view (default sort, first page, no filters) — its server
 * component never reads searchParams. This component wraps the server-
 * rendered grid:
 *
 *   - URL has no meaningful params → render `children` (the static grid)
 *     untouched. Zero behavior change for the canonical view.
 *   - URL has sort / filter / after params → fetch the matching first page
 *     from /api/load-more-products (the same route Phase 217's Load More
 *     already uses) and render the grid client-side, with `PlpLoadMore`
 *     continuing pagination from the returned cursor.
 *
 * Deliberately does NOT call useSearchParams(): on a static route that
 * hook client-side-renders everything up to the nearest Suspense boundary,
 * which would evict the product grid from the prerendered HTML — the exact
 * thing this restructure exists to keep. Instead it reads
 * window.location.search on mount + popstate (back/forward) and listens
 * for the PLP_PARAMS_CHANGED_EVENT that SortControl / FilterPanel /
 * ActiveFilters dispatch (with the new query string as detail) right when
 * they router.push — `location` itself only updates after the soft
 * navigation commits, so the event detail is the source of truth there.
 */

const MEANINGFUL_PARAMS = ['sort', 'after', ...FILTER_PARAMS] as const;

/** Reduce a raw query string to the params that change the grid, in a
 * stable order so identical selections compare equal. */
function meaningfulQuery(search: string): string {
  const inp = new URLSearchParams(search);
  const out = new URLSearchParams();
  for (const p of MEANINGFUL_PARAMS) {
    const v = inp.get(p);
    if (v) out.set(p, v);
  }
  return out.toString();
}

type Fetched = {
  qs: string;
  products: ProductSummary[];
  endCursor: string | null;
  hasNextPage: boolean;
};

type Props = {
  handle: string;
  /** Canonical first-page count, used to reset the toolbar count display
   * when the user clears back to the param-less view. */
  initialCount: number;
  children: ReactNode;
};

export function PlpParamResults({ handle, initialCount, children }: Props) {
  const [qs, setQs] = useState('');
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumping this re-runs the fetch effect for the same qs (retry button).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const fromLocation = () => setQs(meaningfulQuery(window.location.search));
    const fromEvent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setQs(typeof detail === 'string' ? meaningfulQuery(detail) : meaningfulQuery(window.location.search));
    };
    fromLocation();
    window.addEventListener('popstate', fromLocation);
    window.addEventListener(PLP_PARAMS_CHANGED_EVENT, fromEvent);
    return () => {
      window.removeEventListener('popstate', fromLocation);
      window.removeEventListener(PLP_PARAMS_CHANGED_EVENT, fromEvent);
    };
  }, []);

  useEffect(() => {
    if (!qs) {
      setFetched(null);
      setFailed(false);
      // Restore the canonical count when params are cleared (the static
      // children re-appear but PlpCount keeps event-driven state).
      window.dispatchEvent(
        new CustomEvent('plp:count-rendered', { detail: { count: initialCount, filtered: false } }),
      );
      return;
    }
    let cancelled = false;
    setFailed(false);
    const params = new URLSearchParams(qs);
    params.set('handle', handle);
    fetch(`/api/load-more-products?${params.toString()}`, { cache: 'default' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{
          products: ProductSummary[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setFetched({
          qs,
          products: data.products,
          endCursor: data.pageInfo.endCursor,
          hasNextPage: data.pageInfo.hasNextPage,
        });
        const filtered = FILTER_PARAMS.some((p) => new URLSearchParams(qs).has(p));
        window.dispatchEvent(
          new CustomEvent('plp:count-rendered', {
            detail: { count: data.products.length, filtered },
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [qs, handle, attempt, initialCount]);

  // Canonical URL: the server-rendered grid, byte-for-byte.
  if (!qs) return <>{children}</>;

  if (failed) {
    return (
      <div className="plp-empty">
        <div className="plp-empty-mark"><Icon name="search" size={28} /></div>
        <h3 className="h3">Couldn&rsquo;t load these results.</h3>
        <p className="muted">Something went wrong applying your sort or filters.</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </button>
      </div>
    );
  }

  // In flight (or a stale response from the previous selection).
  if (!fetched || fetched.qs !== qs) {
    return (
      <div className="plp-grid" aria-busy="true" aria-label="Loading products">
        {Array.from({ length: 8 }).map((_, i) => (
          <PlpCardSkeleton key={`param-skel-${i}`} />
        ))}
      </div>
    );
  }

  if (fetched.products.length === 0) {
    return (
      <div className="plp-empty">
        <div className="plp-empty-mark"><Icon name="search" size={28} /></div>
        <h3 className="h3">No mattresses match these filters.</h3>
        <p className="muted">Try removing a filter or clearing them all to see more results.</p>
        <Link href={`/collections/${handle}`} className="btn btn-primary">
          Clear all filters
        </Link>
      </div>
    );
  }

  // Split qs back into the shapes PlpLoadMore expects (sort separate from
  // the filter params; `after` is consumed by the initial fetch above and
  // pagination continues from the returned cursor).
  const parsed = new URLSearchParams(qs);
  const sortParam = parsed.get('sort') ?? undefined;
  const filterOnly = new URLSearchParams();
  for (const p of FILTER_PARAMS) {
    const v = parsed.get(p);
    if (v) filterOnly.set(p, v);
  }

  return (
    <>
      <div className="plp-grid">
        {fetched.products.map((p) => (
          <PlpCard key={p.id} product={p} priority={false} />
        ))}
      </div>
      <PlpLoadMore
        key={qs}
        collectionHandle={handle}
        sortParam={sortParam}
        filterQuery={filterOnly.toString()}
        initialCursor={fetched.endCursor}
        initialHasNext={fetched.hasNextPage}
        initialCount={fetched.products.length}
      />
    </>
  );
}
