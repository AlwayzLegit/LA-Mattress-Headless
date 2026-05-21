'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';

const COMPARE_KEY = 'la-mattress.compare.v1';
const COMPARE_EVENT = 'la-mattress:compare-change';
const COMPARE_MAX = 4;

type Snapshot = { handle: string; title?: string };

function readSet(): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(COMPARE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is Snapshot => typeof x === 'object' && x != null && 'handle' in x);
  } catch {
    return [];
  }
}

/**
 * Compare empty-state recovery hint.
 *
 * Mounted alongside the existing "Browse mattresses" CTA on /compare
 * when the URL has no ?ids= param. If the visitor's localStorage
 * compare tray has entries (saved across sessions), surface a one-
 * click link that rebuilds the ?ids= URL — they shouldn't have to
 * re-pick mattresses they already chose.
 *
 * Falls back to nothing when the tray is empty, so the existing
 * empty-state CTA still reads naturally on first-ever visits.
 *
 * Listens for the compare-change event so removing items elsewhere
 * (the floating tray, a PDP) updates the count live without a
 * navigation.
 */
export function CompareTrayHint() {
  const [items, setItems] = useState<Snapshot[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setItems(readSet());
    sync();
    setHydrated(true);
    window.addEventListener(COMPARE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!hydrated || items.length === 0) return null;

  const handles = items.slice(0, COMPARE_MAX).map((p) => p.handle).join(',');
  const href = `/compare?${new URLSearchParams({ ids: handles }).toString()}`;

  return (
    <div className="compare-tray-hint">
      <p className="muted compare-tray-hint-lede">
        You have <strong>{items.length}</strong> mattress{items.length === 1 ? '' : 'es'} in your compare tray
        from a previous session.
      </p>
      <Link href={href} className="btn btn-primary btn-lg">
        Compare them now <Icon name="arrow-right" size={14} />
      </Link>
    </div>
  );
}
