'use client';

import { useEffect, useState } from 'react';
import { getOpenStatus, type Showroom } from '@/lib/showrooms';

// Open/closed status depends on the current time, but the showroom page
// is ISR-cached: the server HTML bakes a stale "now" while the client
// hydrates against the real "now". That text/className mismatch threw
// React #418, which made React re-render the page subtree and re-emit
// the four page-level JSON-LD <script>s (QA P1-2 — duplicate ids in the
// DOM). Computing the status client-only after mount keeps the server
// render and first client render identical (both render nothing), so
// hydration is clean and the duplication disappears.
export function ShowroomOpenStatus({ showroom }: { showroom: Showroom }) {
  const [status, setStatus] = useState<ReturnType<typeof getOpenStatus> | null>(null);

  useEffect(() => {
    setStatus(getOpenStatus(showroom));
  }, [showroom]);

  if (!status) return null;

  return (
    <div className={`showroom-open-status${status.isOpen ? ' is-open' : ''}`}>
      <span className="showroom-open-dot" aria-hidden /> {status.message}
    </div>
  );
}
