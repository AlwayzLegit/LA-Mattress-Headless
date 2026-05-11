'use client';

import { createLocalStoreApi, useLocalStoreSync } from './use-local-store';

/**
 * Compare-list state helpers — shared by `CompareToggle` (per-PLP-card
 * button), `CompareTray` (floating bottom-center pill), and the PDP
 * `PdpCtaRow` Compare button.
 *
 * Phase 212 (cont. from Phase 196 extraction): the read/write/sync
 * pattern is now provided by the generic `use-local-store.ts` API.
 * The exported names (`COMPARE_STORAGE_KEY`, `COMPARE_MAX`,
 * `COMPARE_EVENT`, `CompareSnapshot`, `readCompareSet`,
 * `writeCompareSet`) are preserved verbatim so consumers don't have
 * to change. A new `useCompareSet()` hook is exposed for consumers
 * that previously open-coded the useEffect-with-listeners pattern.
 *
 * The `writeCompareSet` wrapper enforces the 4-item cap via the
 * shared API's `max` field — same behavior as before.
 */

export const COMPARE_STORAGE_KEY = 'la-mattress.compare.v1';
export const COMPARE_MAX = 4;
export const COMPARE_EVENT = 'la-mattress:compare-change';

export type CompareSnapshot = { handle: string; title: string };

const COMPARE_API = createLocalStoreApi<CompareSnapshot>({
  key: COMPARE_STORAGE_KEY,
  event: COMPARE_EVENT,
  max: COMPARE_MAX,
  isValid: (x): x is CompareSnapshot =>
    typeof x === 'object' && x != null && 'handle' in x,
});

export const readCompareSet = COMPARE_API.read;
export const writeCompareSet = COMPARE_API.write;

/**
 * React hook: hydrates the current compare set and re-renders the
 * caller when the set changes (this tab or another). Returns the same
 * `{ items, hydrated }` shape every consumer was open-coding.
 */
export function useCompareSet() {
  return useLocalStoreSync(COMPARE_API);
}

/**
 * Routes where the floating compare tray is contextually meaningful
 * (the visitor is in shopping mode). Hide everywhere else — quiz,
 * blog, account, locations, cart, /compare itself, 404, etc. — so
 * the tray doesn't cover content the visitor is actually trying to
 * read. The localStorage selection persists in either case; the tray
 * reappears the moment the visitor returns to a PLP/PDP/home/search.
 */
export function isShoppingRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (pathname.startsWith('/collections/')) return true;
  if (pathname.startsWith('/products/')) return true;
  if (pathname === '/search') return true;
  return false;
}
