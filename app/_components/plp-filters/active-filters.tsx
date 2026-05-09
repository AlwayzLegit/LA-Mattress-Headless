'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  clearAllFilters,
  withFilterChange,
  type FilterParam,
  type FilterSelection,
} from './filters';
import { Icon } from '@/app/_components/icon';

type Chip = { label: string; param: FilterParam; value?: string };

function chipsForSelection(sel: FilterSelection): Chip[] {
  const chips: Chip[] = [];
  for (const v of sel.vendor)        chips.push({ label: v, param: 'vendor', value: v });
  for (const t of sel.type)          chips.push({ label: t, param: 'type', value: t });
  for (const s of sel.size)          chips.push({ label: s, param: 'size', value: s });
  for (const v of sel.firmness)      chips.push({ label: v, param: 'firmness', value: v });
  for (const v of sel.sleepPosition) chips.push({ label: v, param: 'sleepPosition', value: v });
  for (const v of sel.heightRange)   chips.push({ label: v, param: 'heightRange', value: v });
  if (sel.price) {
    const { min, max } = sel.price;
    const label =
      min !== undefined && max !== undefined ? `$${min}–$${max}` :
      min !== undefined ? `$${min}+` :
      max !== undefined ? `Under $${max}` :
      'Price';
    chips.push({ label, param: 'price' });
  }
  return chips;
}

export function ActiveFilters({ sel }: { sel: FilterSelection }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const chips = chipsForSelection(sel);
  if (!chips.length) return null;

  const push = (next: URLSearchParams) => {
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const onRemove = (chip: Chip) => {
    if (chip.param === 'price') {
      push(withFilterChange(new URLSearchParams(params.toString()), { param: 'price', op: 'clear' }));
      return;
    }
    push(withFilterChange(new URLSearchParams(params.toString()), {
      param: chip.param,
      value: chip.value,
      op: 'toggle',
    }));
  };

  return (
    <div
      className={`plp-active-filters ${pending ? 'is-pending' : ''}`}
      role="group"
      aria-label="Active filters"
    >
      {chips.map((c, i) => (
        <button
          key={`${c.param}-${c.value ?? 'price'}-${i}`}
          type="button"
          className="plp-active-chip"
          onClick={() => onRemove(c)}
          aria-label={`Remove ${c.label} filter`}
        >
          {c.label}
          <Icon name="close" size={12} />
        </button>
      ))}
      <button
        type="button"
        className="plp-active-clear"
        onClick={() => push(clearAllFilters(new URLSearchParams(params.toString())))}
      >
        Clear all
      </button>
    </div>
  );
}
