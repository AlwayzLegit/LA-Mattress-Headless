'use client';

import { useEffect, useState } from 'react';

const KEY = 'la-mattress.wishlist.v1';
const EVENT = 'la-mattress:wishlist-change';

/**
 * Reads the wishlist count from localStorage and renders a sub-label
 * for the /account "Saved mattresses" tile. Falls back to a neutral
 * "Your shortlist" when nothing is saved yet so the tile still reads
 * useful on first visit.
 */
export function AccountSavedCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) { setCount(0); return; }
        const arr = JSON.parse(raw);
        setCount(Array.isArray(arr) ? arr.length : 0);
      } catch {
        setCount(0);
      }
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // null while pre-hydrate so the SSR shell doesn't flash a 0-state
  // count that flickers when localStorage resolves.
  if (count === null) {
    return <div className="account-tile-sub muted">Your shortlist</div>;
  }

  if (count === 0) {
    return <div className="account-tile-sub muted">Tap a heart to save</div>;
  }

  return (
    <div className="account-tile-sub muted">
      {count} mattress{count === 1 ? '' : 'es'} saved
    </div>
  );
}
