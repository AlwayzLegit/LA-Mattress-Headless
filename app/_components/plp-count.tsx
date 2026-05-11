'use client';

import { useEffect, useState } from 'react';

/**
 * PLP result-count display ("Showing 24 of 169 mattresses") that
 * stays in sync as the user appends pages via `PlpLoadMore`.
 *
 * Phase 217: previously a server-rendered `<span>` whose text only
 * reflected the SSR'd first page count. Once the user clicked
 * Load More (pre-Phase-217 a full page navigation), the count flipped
 * to "Showing N more products" — losing the running total. Now this
 * client island subscribes to the `'plp:count-rendered'` window event
 * dispatched by `PlpLoadMore` whenever a new page lands, and re-renders
 * with the cumulative count.
 *
 * Initial render is server-side (props pre-populated from the SSR
 * count + Shopify total), so the value is correct at first paint —
 * the event subscription only activates after hydration.
 *
 * `aria-live="polite"` so screen-reader users hear the count change
 * announce after each Load More click. Without this, the visible
 * text change is silent.
 */
type Props = {
  initial: number;
  /** Total product count from inventory snapshot. `null` when filters
   * are applied (the snapshot is unfiltered, so showing "of N" would
   * mislead) or when the snapshot itself is missing the collection. */
  total: number | null;
  /** `true` when one or more filters are active. Controls the
   * count-display branching when nothing matches. */
  hasFiltersApplied: boolean;
};

export function PlpCount({ initial, total, hasFiltersApplied }: Props) {
  const [rendered, setRendered] = useState(initial);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === 'number') setRendered(detail);
    };
    window.addEventListener('plp:count-rendered', handler);
    return () => window.removeEventListener('plp:count-rendered', handler);
  }, []);

  if (rendered === 0) {
    return (
      <span className="plp-toolbar-count" aria-live="polite">
        No products match your filters
      </span>
    );
  }

  const productWord = `product${rendered === 1 ? '' : 's'}`;
  const totalWord = total != null ? `product${total === 1 ? '' : 's'}` : productWord;

  return (
    <span className="plp-toolbar-count" aria-live="polite">
      {hasFiltersApplied || total == null
        ? `Showing ${rendered} ${productWord}`
        : `Showing ${rendered} of ${total} ${totalWord}`}
    </span>
  );
}
