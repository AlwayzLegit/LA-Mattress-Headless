'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { announce } from '@/app/_components/announcer';
import { notifyPlpParamsChanged } from '@/app/_components/plp-filters';

type Option = { value: string; label: string; index: number };

// perf-isr-07: the current sort is derived from useSearchParams instead of
// a server prop — the PLP is static and its server render never sees
// searchParams, so a prop would always claim the default sort on deep-
// linked ?sort= URLs. This component sits inside its own tight <Suspense>
// on the page (useSearchParams on a static route CSRs up to the nearest
// boundary).
export function SortControl({ options }: { options: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get('sort') ?? '';
  const selected = options.some((o) => o.value === current)
    ? current
    : options[0]?.value ?? '';

  const onChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value;
    // Changing sort keeps the active filters, resets the `after` cursor
    // (a cursor only makes sense within the prior ordering), and drops
    // the param entirely when the default sort is chosen so the URL
    // returns to its canonical form.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('after');
    if (value && value !== options[0]?.value) params.set('sort', value);
    else params.delete('sort');
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
    notifyPlpParamsChanged(qs);
  };

  return (
    <label className="plp-toolbar-sort">
      <span className="muted">Sort:</span>
      <select onChange={onChange} value={selected}>
        {options.map((o) => (
          <option key={`${o.value}-${o.index}`} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
