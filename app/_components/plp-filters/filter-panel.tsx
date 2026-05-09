'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useTransition } from 'react';
import type { AvailableFilter } from '@/lib/shopify';
import { useFocusTrap } from '../use-focus-trap';
import { announce } from '../announcer';
import {
  FILTER_PARAMS,
  clearAllFilters,
  paramForFilterId,
  parseFilterSelection,
  withFilterChange,
  hasAnyFilter,
  type FilterParam,
  type FilterSelection,
} from './filters';
import { useFilterShell } from './filter-shell';
import { Icon } from '@/app/_components/icon';
import type { AvailableFilterValue } from '@/lib/shopify';

// Shopify returns filter values in metafield-definition order, which is
// alphabetical for text values (e.g. "10-12 inches", "12-14 inches" ok,
// but "8-10" sorts AFTER "12-14" because of leading-digit alphabetic
// compare). Sort numerically when the param is height-bucketed; size
// follows mattress-size order; everything else stays as Shopify returned
// (which preserves count or relevance).
const SIZE_ORDER = ['Twin', 'Twin XL', 'Full', 'Full XL', 'Queen', 'King', 'California King', 'Cal King', 'Split King', 'Split Cal King'];

function sortValuesForParam(param: string, values: AvailableFilterValue[]): AvailableFilterValue[] {
  if (param === 'heightRange') {
    return [...values].sort((a, b) => {
      const an = parseFloat(a.label) || 0;
      const bn = parseFloat(b.label) || 0;
      return an - bn;
    });
  }
  if (param === 'size') {
    return [...values].sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a.label);
      const bi = SIZE_ORDER.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }
  return values;
}

type Props = {
  availableFilters: AvailableFilter[];
  /** Current result count, used in the mobile "Show N results" CTA. */
  resultCount?: number;
};

export function FilterPanel({ availableFilters, resultCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { open: mobileOpen, setOpen: setMobileOpen } = useFilterShell();
  const asideRef = useRef<HTMLElement>(null);
  const didMountRef = useRef(false);

  // Tab cycles within the filter drawer when it's open on mobile;
  // close (X / scrim / Esc / matchMedia widen) restores focus.
  useFocusTrap(mobileOpen, asideRef);

  // Announce result count after each filter change (URL-driven, so a
  // change re-renders the page server-side and this component remounts
  // with a new resultCount). Skip the initial render so we don't
  // announce on first arrival to /collections/{handle}. SR users
  // toggling a filter checkbox now hear "Now showing N mattresses"
  // instead of waiting silently for the table of products to update.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (typeof resultCount !== 'number') return;
    announce(
      resultCount === 0
        ? 'No mattresses match those filters'
        : `Now showing ${resultCount} mattress${resultCount === 1 ? '' : 'es'}`,
    );
  }, [resultCount]);

  const sel = useMemo<FilterSelection>(() => {
    const obj: Record<string, string | undefined> = {};
    for (const p of FILTER_PARAMS) {
      const v = params.get(p);
      if (v !== null) obj[p] = v;
    }
    return parseFilterSelection(obj);
  }, [params]);

  const push = (next: URLSearchParams) => {
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const onToggle = (param: FilterParam, value: string) => {
    push(withFilterChange(new URLSearchParams(params.toString()), { param, value, op: 'toggle' }));
  };

  const onPriceSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const min = (form.elements.namedItem('min') as HTMLInputElement | null)?.value.trim() ?? '';
    const max = (form.elements.namedItem('max') as HTMLInputElement | null)?.value.trim() ?? '';
    const value = min || max ? `${min}-${max}` : '';
    push(
      withFilterChange(new URLSearchParams(params.toString()), {
        param: 'price',
        value,
        op: 'set',
      }),
    );
  };

  const onClearAll = () => push(clearAllFilters(new URLSearchParams(params.toString())));

  const isActive = (param: FilterParam, value: string): boolean => {
    if (param === 'vendor') return sel.vendor.includes(value);
    if (param === 'type')   return sel.type.includes(value);
    if (param === 'size')   return sel.size.includes(value);
    if (param === 'firmness')      return sel.firmness.includes(value);
    if (param === 'sleepPosition') return sel.sleepPosition.includes(value);
    if (param === 'heightRange')   return sel.heightRange.includes(value);
    return false;
  };

  // Group facets into the four buckets we render. Order matters for visual hierarchy.
  const grouped = availableFilters
    .map((f) => ({ filter: f, param: paramForFilterId(f.id) }))
    .filter((g): g is { filter: AvailableFilter; param: FilterParam } => g.param !== null);

  if (!grouped.length) return null;

  const cls = [
    'plp-filters',
    pending ? 'is-pending' : '',
    mobileOpen ? 'is-mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {mobileOpen ? (
        <div className="plp-filters-scrim" onClick={() => setMobileOpen(false)} aria-hidden />
      ) : null}
      <aside ref={asideRef} className={cls} aria-label="Filter products" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined}>
      <div className="plp-filters-head">
        <span className="eyebrow">Filter</span>
        <div className="plp-filters-head-actions">
          {hasAnyFilter(sel) ? (
            <button type="button" className="plp-filters-clear" onClick={onClearAll}>
              Clear all
            </button>
          ) : null}
          <button
            type="button"
            className="plp-filters-close icon-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close filters"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      </div>

      <div className="plp-filters-body">
        {grouped.map(({ filter, param }) => (
          <details key={filter.id} className="plp-filter-group" open>
            <summary>
              <span>{filter.label}</span>
              <Icon name="chevron-down" size={14} />
            </summary>
            <div className="plp-filter-body">
              {param === 'price' ? (
                <PriceFilter sel={sel} onSubmit={onPriceSubmit} />
              ) : (
                <ul className="plp-filter-values">
                  {sortValuesForParam(param, filter.values).map((v) => (
                    <li key={v.id}>
                      <label className="plp-filter-row">
                        <input
                          type="checkbox"
                          checked={isActive(param, v.label)}
                          onChange={() => onToggle(param, v.label)}
                        />
                        <span className="plp-filter-label">{v.label}</span>
                        <span className="plp-filter-count tnum">{v.count}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </div>

      {mobileOpen ? (
        <div className="plp-filters-mobile-foot">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setMobileOpen(false)}>
            {typeof resultCount === 'number'
              ? `Show ${resultCount} result${resultCount === 1 ? '' : 's'}`
              : 'Show results'}
          </button>
        </div>
      ) : null}
      </aside>
    </>
  );
}

function PriceFilter({
  sel,
  onSubmit,
}: {
  sel: FilterSelection;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="plp-filter-price" onSubmit={onSubmit}>
      <label className="plp-filter-price-input">
        <span className="muted">Min</span>
        <input
          type="number"
          name="min"
          inputMode="numeric"
          min={0}
          placeholder="$"
          defaultValue={sel.price?.min ?? ''}
        />
      </label>
      <label className="plp-filter-price-input">
        <span className="muted">Max</span>
        <input
          type="number"
          name="max"
          inputMode="numeric"
          min={0}
          placeholder="$"
          defaultValue={sel.price?.max ?? ''}
        />
      </label>
      <button type="submit" className="btn btn-ghost btn-sm">Apply</button>
    </form>
  );
}
