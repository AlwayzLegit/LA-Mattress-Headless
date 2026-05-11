'use client';

import { useEffect, useState } from 'react';

/**
 * Generic localStorage-store pattern with cross-tab sync.
 *
 * Phase 211 extraction. Four components in this codebase persist a small
 * list to `window.localStorage` and want to react to changes from other
 * tabs / other components: `compare-store`, `wishlist-view`, `pdp-cta-row`
 * (which today duplicates the compare + wishlist constants verbatim),
 * and `recently-viewed`. Each was open-coding the same six lines of
 * read / write / dispatchEvent / useEffect-with-add-and-remove-listeners.
 *
 * The duplication is more than aesthetic — `pdp-cta-row.tsx` had inline
 * copies of `COMPARE_KEY`, `COMPARE_EVENT`, and `COMPARE_MAX` that drift
 * silently if `compare-store.ts` is ever edited. Centralizing the API
 * + hook into this module forces single-source-of-truth for the keys
 * and removes ~80 LOC of duplicated logic across the four consumers.
 *
 * ## API surface
 *
 * `createLocalStoreApi<T>({ key, event, isValid, max? })` — returns an
 *   object with `{ key, event, max, read, write }`. Module-scope helpers
 *   are usable from anywhere (imperative click handlers, server-rendered
 *   fallbacks, etc.) without hooking into React. `write` automatically
 *   slices to `max` if configured and fires the `event` so other
 *   listeners (including the hook below) re-read.
 *
 * `useLocalStoreSync<T>(api)` — React hook. Hydrates `items` from
 *   localStorage on mount, subscribes to both `api.event` (same-tab
 *   change notification) and the browser's `storage` event (cross-tab
 *   change notification), and returns `{ items, hydrated }`. The
 *   `hydrated` flag lets the caller render a skeleton or `return null`
 *   during the first paint so SSR HTML doesn't mismatch the client tree.
 *
 * Both pieces are intentionally split so imperative callers can `read()`
 * / `write()` without committing to a hook (and triggering re-renders),
 * and hook-callers don't have to also import the api functions.
 *
 * ## Type-narrowing requirement
 *
 * The `isValid` user predicate runs on every entry in the parsed JSON
 * array. localStorage values are inherently untyped (`unknown`); a
 * drive-by edit of the raw key value via DevTools could ship invalid
 * data into the in-memory list. The predicate filters those out so
 * downstream renderers can rely on the typed shape without further
 * runtime checks.
 */

export type LocalStoreApi<T> = {
  key: string;
  event: string;
  max: number | undefined;
  read: () => T[];
  write: (items: T[]) => void;
};

export function createLocalStoreApi<T>(config: {
  key: string;
  event: string;
  isValid: (x: unknown) => x is T;
  /** If set, `write` truncates to this many items before persisting. */
  max?: number;
}): LocalStoreApi<T> {
  const { key, event, isValid, max } = config;

  function read(): T[] {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr.filter(isValid);
    } catch {
      return [];
    }
  }

  function write(items: T[]) {
    try {
      const trimmed = max === undefined ? items : items.slice(0, max);
      window.localStorage.setItem(key, JSON.stringify(trimmed));
      window.dispatchEvent(new Event(event));
    } catch {
      // ignore quota / private-mode failures — best-effort persistence
    }
  }

  return { key, event, max, read, write };
}

/**
 * Hydrate-and-subscribe hook for a store created with `createLocalStoreApi`.
 *
 * Returns `{ items, hydrated }`. `hydrated` flips true after the first
 * render so callers can guard SSR-mismatch-sensitive UI:
 *
 *   const { items, hydrated } = useLocalStoreSync(WISHLIST_API);
 *   if (!hydrated) return null;
 *
 * Listens to both the configured custom event (same-tab updates from
 * other components) and the native `storage` event (cross-tab updates),
 * matching the original ad-hoc pattern.
 */
export function useLocalStoreSync<T>(api: LocalStoreApi<T>): {
  items: T[];
  hydrated: boolean;
} {
  const [items, setItems] = useState<T[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setItems(api.read());
    sync();
    setHydrated(true);
    window.addEventListener(api.event, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(api.event, sync);
      window.removeEventListener('storage', sync);
    };
  }, [api]);

  return { items, hydrated };
}
