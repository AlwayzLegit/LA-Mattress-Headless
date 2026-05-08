'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';

const KEY = 'la-mattress.compare.v1';
const MAX = 4;
const EVENT = 'la-mattress:compare-change';

/**
 * Routes where the floating compare tray is contextually meaningful (the
 * visitor is in shopping mode). Hide everywhere else — quiz, blog, account,
 * locations, cart, /compare itself, 404, etc. — to avoid covering content
 * the visitor is actually trying to read.
 */
function isShoppingRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (pathname.startsWith('/collections/')) return true;
  if (pathname.startsWith('/products/')) return true;
  if (pathname === '/search') return true;
  return false;
}

type Snapshot = { handle: string; title: string };

function readSet(): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is Snapshot => typeof x === 'object' && x != null && 'handle' in x);
  } catch {
    return [];
  }
}

function writeSet(items: Snapshot[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Adds/removes a product from the compare set. Lives inside a PLP card —
 * the click handler stops propagation so it doesn't trigger the parent
 * <Link>'s navigation.
 *
 * Cap is MAX (4 items) — beyond that we silently no-op the add. Keeps the
 * compare table from getting unwieldy.
 */
export function CompareToggle({ handle, title }: { handle: string; title: string }) {
  const [selected, setSelected] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setSelected(readSet().some((p) => p.handle === handle));
    sync();
    setHydrated(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [handle]);

  const onToggle = (e: React.MouseEvent | React.ChangeEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = readSet();
    const idx = cur.findIndex((p) => p.handle === handle);
    if (idx >= 0) {
      cur.splice(idx, 1);
    } else if (cur.length < MAX) {
      cur.push({ handle, title });
    } else {
      // already 4 selected — flash a tiny visual cue but don't crash.
      return;
    }
    writeSet(cur);
  };

  // Don't render until hydrated so SSR matches first paint.
  if (!hydrated) return null;

  return (
    <button
      type="button"
      className={`compare-toggle${selected ? ' is-selected' : ''}`}
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={selected ? `Remove ${title} from compare` : `Add ${title} to compare (up to ${MAX})`}
    >
      <span className="compare-toggle-box" aria-hidden>
        {selected ? <Icon name="check" size={12} /> : null}
      </span>
      Compare
    </button>
  );
}

/**
 * Floating bottom-center pill that appears when the visitor has selected
 * at least one product to compare. Tap to open /compare with the selected
 * handles. Visible site-wide; rendered in the root layout.
 */
export function CompareTray() {
  const [items, setItems] = useState<Snapshot[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [nearFooter, setNearFooter] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => setItems(readSet());
    sync();
    setHydrated(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Auto-hide when the footer is in view so the tray doesn't cover the
  // legal links / copyright row.
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setNearFooter(entry.isIntersecting),
      { rootMargin: '0px 0px -40px 0px', threshold: 0 },
    );
    io.observe(footer);
    return () => io.disconnect();
  }, [hydrated]);

  // Reset dismissed state when path changes — different page, give it
  // another chance to surface.
  useEffect(() => { setDismissed(false); }, [pathname]);

  if (!hydrated || items.length === 0) return null;
  // Tray is contextually relevant only on shopping templates. On reading /
  // utility / non-shop pages, hide it — the localStorage selection persists
  // so the tray reappears the moment the visitor returns to a PLP/PDP/home/search.
  if (!isShoppingRoute(pathname)) return null;
  if (dismissed) return null;
  if (nearFooter) return null;

  const ids = items.map((i) => i.handle).join(',');

  const clear = () => writeSet([]);
  const dismiss = () => setDismissed(true);

  return (
    <div className="compare-tray" role="region" aria-label="Compare products">
      <div className="compare-tray-inner">
        <span className="compare-tray-count tnum">{items.length}</span>
        <span className="compare-tray-label">
          {items.length === 1 ? 'item ready to compare' : 'items ready to compare'}
        </span>
        <Link href={`/compare?ids=${encodeURIComponent(ids)}`} className="btn btn-primary compare-tray-cta">
          Compare {items.length > 1 ? `(${items.length})` : ''} <Icon name="arrow-right" size={14} />
        </Link>
        <button type="button" className="compare-tray-clear" onClick={clear} aria-label="Clear compare list">
          Clear
        </button>
        <button type="button" className="compare-tray-dismiss" onClick={dismiss} aria-label="Hide compare bar (selection kept)">
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
