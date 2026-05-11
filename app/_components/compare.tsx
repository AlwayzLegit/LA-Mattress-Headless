'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { announce } from './announcer';
import {
  COMPARE_EVENT,
  COMPARE_MAX,
  isShoppingRoute,
  readCompareSet,
  writeCompareSet,
  type CompareSnapshot,
} from './compare-store';

/**
 * Adds/removes a product from the compare set. Lives inside a PLP card —
 * the click handler stops propagation so it doesn't trigger the parent
 * <Link>'s navigation.
 *
 * Cap is COMPARE_MAX (4 items) — beyond that we silently no-op the add
 * (with an SR announcement explaining why). Keeps the compare table
 * from getting unwieldy.
 */
export function CompareToggle({ handle, title }: { handle: string; title: string }) {
  const [selected, setSelected] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setSelected(readCompareSet().some((p) => p.handle === handle));
    sync();
    setHydrated(true);
    window.addEventListener(COMPARE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [handle]);

  const onToggle = (e: React.MouseEvent | React.ChangeEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = readCompareSet();
    const idx = cur.findIndex((p) => p.handle === handle);
    if (idx >= 0) {
      cur.splice(idx, 1);
      writeCompareSet(cur);
      announce(`Removed ${title} from compare`);
    } else if (cur.length < COMPARE_MAX) {
      cur.push({ handle, title });
      writeCompareSet(cur);
      announce(`Added ${title} to compare. ${cur.length} of ${COMPARE_MAX} selected.`);
    } else {
      // Already 4 selected — surface it audibly so SR users know why
      // their click did nothing.
      announce(`Compare is full. Remove one of the ${COMPARE_MAX} selected mattresses first.`);
    }
  };

  // Don't render until hydrated so SSR matches first paint.
  if (!hydrated) return null;

  return (
    <button
      type="button"
      className={`compare-toggle${selected ? ' is-selected' : ''}`}
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={selected ? `Remove ${title} from compare` : `Add ${title} to compare (up to ${COMPARE_MAX})`}
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
  const [items, setItems] = useState<CompareSnapshot[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [nearFooter, setNearFooter] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => setItems(readCompareSet());
    sync();
    setHydrated(true);
    window.addEventListener(COMPARE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync);
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

  const clear = () => {
    writeCompareSet([]);
    announce('Cleared compare list');
  };
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
