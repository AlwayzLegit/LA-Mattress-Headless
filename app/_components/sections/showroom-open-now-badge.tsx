'use client';

import { useEffect, useState } from 'react';
import { findShowroom, getOpenStatus, type Showroom } from '@/lib/showrooms';

/**
 * Tiny client island for the homepage Showrooms section's open-now
 * status badge. The parent section is a server component and the
 * homepage is statically rendered, so getOpenStatus can't run during
 * SSR — it would freeze at build time forever. This island runs
 * useEffect on mount to compute current status from the visitor's
 * device clock (LA wall time inside getOpenStatus regardless).
 *
 * Renders nothing pre-hydration so the SSR HTML stays clean and
 * there's no flash of stale "Open now" data. After mount, the badge
 * appears with the current status. Same UX as the previous Phase 32-
 * era 'use client' Showrooms component, but the cost of hydrating
 * just this 5-line badge is ~10x less than hydrating the entire
 * Showrooms section.
 */
export function ShowroomOpenNowBadge({ canonicalHandle }: { canonicalHandle: string }) {
  const [status, setStatus] = useState<{ isOpen: boolean } | null>(null);

  useEffect(() => {
    const showroom: Showroom | undefined = findShowroom(canonicalHandle);
    if (!showroom) return;
    setStatus(getOpenStatus(showroom));
  }, [canonicalHandle]);

  if (!status) return null;
  return (
    <span className={`showroom-status${status.isOpen ? ' is-open' : ''}`}>
      <span className="showroom-status-dot" aria-hidden />
      {status.isOpen ? 'Open now' : 'Closed'}
    </span>
  );
}
