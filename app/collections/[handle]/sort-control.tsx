'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ChangeEvent } from 'react';

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
