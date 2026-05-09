'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { announce } from '@/app/_components/announcer';

type Option = { value: string; label: string; index: number };

export function SortControl({ options, currentIndex }: { options: Option[]; currentIndex: number }) {
  const router = useRouter();
  const pathname = usePathname();

  const onChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value;
    const params = new URLSearchParams();
    if (value) params.set('sort', value);
    // Reset pagination cursor whenever sort changes — clears `after`.
    const qs = params.toString();
    // Announce the new sort criterion. Fires synchronously on change,
    // which is the right time — the page is about to navigate, so
    // announcing post-navigation could land on a fresh module if SortControl
    // is ever wrapped in a keyed Suspense boundary (currently it isn't,
    // but the FilterPanel/F1 bug taught us not to depend on remount
    // behavior for SR feedback).
    const newLabel = options.find((o) => o.value === value)?.label ?? options[0]?.label;
    if (newLabel) announce(`Sorted by ${newLabel}`);
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: true });
  };

  return (
    <label className="plp-toolbar-sort">
      <span className="muted">Sort:</span>
      <select onChange={onChange} value={options[currentIndex]?.value ?? ''}>
        {options.map((o) => (
          <option key={`${o.value}-${o.index}`} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
