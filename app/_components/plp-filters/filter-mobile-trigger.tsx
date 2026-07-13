'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/app/_components/icon';
import { useFilterShell } from './filter-shell';
import { FILTER_PARAMS, parseFilterSelection, type FilterSelection } from './filters';

function activeCount(sel: FilterSelection): number {
  return (
    sel.vendor.length +
    sel.type.length +
    sel.size.length +
    sel.firmness.length +
    sel.sleepPosition.length +
    sel.heightRange.length +
    (sel.price ? 1 : 0)
  );
}

// perf-isr-07: selection is derived from useSearchParams instead of a
// server prop (the static PLP's server render never sees searchParams).
// Rendered inside a tight <Suspense> on the page.
export function FilterMobileTrigger() {
  const { setOpen } = useFilterShell();
  const params = useSearchParams();
  const sel = useMemo<FilterSelection>(() => {
    const obj: Record<string, string | undefined> = {};
    for (const p of FILTER_PARAMS) {
      const v = params.get(p);
      if (v !== null) obj[p] = v;
    }
    return parseFilterSelection(obj);
  }, [params]);
  const count = activeCount(sel);
  return (
    <button
      type="button"
      className="plp-filters-mobile-trigger"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-label={count > 0 ? `Filter, ${count} active` : 'Filter'}
    >
      <Icon name="menu" size={14} />
      <span aria-hidden="true">Filter</span>
      {count > 0 ? (
        <span className="plp-filters-mobile-count tnum" aria-hidden="true">{count}</span>
      ) : null}
    </button>
  );
}
