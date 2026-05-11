/**
 * Compare-list state helpers — shared by `CompareToggle` (per-PLP-card
 * button) and `CompareTray` (floating bottom-center pill).
 *
 * Phase 196 extraction: previously inlined in `compare.tsx` alongside
 * both components. Hoisting to its own module sets up the Phase 197
 * file split — once each component lives in its own file, the layout
 * chunk (which only needs the tray) can tree-shake the toggle and
 * vice versa for PLP/search route chunks. Tree-shaking that elimination
 * is only possible when the components and their shared helpers come
 * from distinct ES modules.
 *
 * No behavior changes here — read/write logic, the localStorage key,
 * the cap, the cross-tab event name, and the shopping-route predicate
 * are all moved verbatim from `compare.tsx`.
 */

export const COMPARE_STORAGE_KEY = 'la-mattress.compare.v1';
export const COMPARE_MAX = 4;
export const COMPARE_EVENT = 'la-mattress:compare-change';

export type CompareSnapshot = { handle: string; title: string };

export function readCompareSet(): CompareSnapshot[] {
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is CompareSnapshot =>
        typeof x === 'object' && x != null && 'handle' in x,
    );
  } catch {
    return [];
  }
}

export function writeCompareSet(items: CompareSnapshot[]) {
  try {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify(items.slice(0, COMPARE_MAX)),
    );
    window.dispatchEvent(new Event(COMPARE_EVENT));
  } catch {
    // ignore quota / private mode
  }
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
