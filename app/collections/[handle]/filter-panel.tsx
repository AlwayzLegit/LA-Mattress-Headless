'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import type { AvailableFilter } from '@/lib/shopify';
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
import { Icon } from '@/app/_components/icon';

type Props = { availableFilters: AvailableFilter[] };

export function FilterPanel({ availableFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

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
    if (param === 'type') return sel.type.includes(value);
    if (param === 'size') return sel.size.includes(value);
    return false;
  };

  // Group facets into the four buckets we render. Order matters for visual hierarchy.
  const grouped = availableFilters
    .map((f) => ({ filter: f, param: paramForFilterId(f.id) }))
    .filter((g): g is { filter: AvailableFilter; param: FilterParam } => g.param !== null);

  if (!grouped.length) return null;

  return (
    <aside className={`plp-filters ${pending ? 'is-pending' : ''}`} aria-label="Filter products">
      <div className="plp-filters-head">
        <span className="eyebrow">Filter</span>
        {hasAnyFilter(sel) ? (
          <button type="button" className="plp-filters-clear" onClick={onClearAll}>
            Clear all
          </button>
        ) : null}
      </div>

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
                {filter.values.map((v) => (
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
    </aside>
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
