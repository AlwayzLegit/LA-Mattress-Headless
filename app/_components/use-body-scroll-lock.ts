'use client';

import { useEffect } from 'react';

/**
 * Shared body-scroll lock for modal-style overlays (cart drawer, mobile
 * nav drawer, search overlay, mobile filter shell). Stack-aware so
 * multiple overlays open concurrently don't leave the body permanently
 * locked when they close in a different order than they opened.
 *
 * The naive per-component pattern (`prev = body.style.overflow;
 * body.style.overflow='hidden'; return restore`) breaks when two modals
 * open at once: the second captures `prev = 'hidden'` (the first's
 * lock), and on close restores `hidden` — body stays locked even after
 * both have closed.
 *
 * This hook tracks active locks via a module-scoped counter. The first
 * caller saves the original `body.style.overflow` and applies `hidden`;
 * subsequent callers just bump the counter; the LAST caller to release
 * restores the original value.
 *
 * Pass `false` (or omit) to release the lock — useful when the
 * component conditionally renders inside a parent that always mounts.
 */

let activeCount = 0;
let savedOverflow: string | null = null;

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (activeCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    activeCount += 1;

    return () => {
      activeCount -= 1;
      if (activeCount === 0) {
        document.body.style.overflow = savedOverflow ?? '';
        savedOverflow = null;
      }
    };
  }, [active]);
}
