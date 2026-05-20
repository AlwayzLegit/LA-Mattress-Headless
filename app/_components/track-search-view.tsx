'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Fires a `search` event once per query submission on the /search page.
 *
 * Server-component parent computes the per-bucket counts already (for
 * the tab badges), so we accept them as props and forward — no extra
 * round-trip. Re-fires when `query` changes so paginating within the
 * same query doesn't double-count, but typing a new query does count.
 *
 * `zero_result` is precomputed here so PostHog filter chips can split
 * on it directly without a HogQL aggregation.
 */
export function TrackSearchView({
  query,
  resultCount,
}: {
  query: string;
  resultCount: number;
}) {
  useEffect(() => {
    if (!query) return;
    track('search', { query, result_count: resultCount });
  }, [query, resultCount]);

  return null;
}
