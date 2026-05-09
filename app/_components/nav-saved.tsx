'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icon';

const WISHLIST_KEY = 'la-mattress.wishlist.v1';
const WISHLIST_EVENT = 'la-mattress:wishlist-change';

/**
 * Heart icon in the nav action area linking to /wishlist. Shows a small
 * red count badge when the visitor has saved one or more mattresses on
 * this device. Hidden until hydrate so SSR doesn't ship a 0-state badge
 * that flickers when localStorage is read.
 */
export function NavSaved() {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = window.localStorage.getItem(WISHLIST_KEY);
        if (!raw) { setCount(0); return; }
        const arr = JSON.parse(raw);
        setCount(Array.isArray(arr) ? arr.length : 0);
      } catch {
        setCount(0);
      }
    };
    sync();
    setHydrated(true);
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <Link
      className="icon-btn"
      aria-label={hydrated && count > 0 ? `Saved, ${count} item${count === 1 ? '' : 's'}` : 'Saved'}
      href="/wishlist"
    >
      <Icon name="heart" size={18} />
      {hydrated && count > 0 ? (
        // Decorative — the parent <Link> already exposes the count
        // via its dynamic aria-label, so the visible badge is just a
        // visual cue. aria-hidden so SR doesn't double-read "3 items"
        // followed by "3".
        <span className="nav-saved-count" aria-hidden="true">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  );
}
