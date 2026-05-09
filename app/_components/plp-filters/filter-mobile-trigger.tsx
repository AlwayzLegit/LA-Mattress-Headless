'use client';

import { Icon } from '@/app/_components/icon';
import { useFilterShell } from './filter-shell';
import type { FilterSelection } from './filters';

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

export function FilterMobileTrigger({ sel }: { sel: FilterSelection }) {
  const { setOpen } = useFilterShell();
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
