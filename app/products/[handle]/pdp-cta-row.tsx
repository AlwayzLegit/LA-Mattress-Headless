'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/app/_components/icon';

const COMPARE_KEY = 'la-mattress.compare.v1';
const COMPARE_EVENT = 'la-mattress:compare-change';
const COMPARE_MAX = 4;

const WISHLIST_KEY = 'la-mattress.wishlist.v1';
const WISHLIST_EVENT = 'la-mattress:wishlist-change';

/**
 * Snapshot persisted to localStorage when a visitor saves or compares a
 * mattress. handle + title are the only required fields (kept stable for
 * v1-era saves that pre-date image/price capture). Newer saves enrich
 * with vendor + image + price so the /wishlist and /compare pages can
 * render a real card without a server roundtrip.
 *
 * Anyone reading this set should treat the optional fields as truly
 * optional and fall back to the handle+title minimum for older entries.
 */
type Snapshot = {
  handle: string;
  title: string;
  vendor?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  priceAmount?: string | null;
  priceCurrency?: string | null;
};

function readSet(key: string): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is Snapshot => typeof x === 'object' && x != null && 'handle' in x);
  } catch {
    return [];
  }
}

function writeSet(key: string, eventName: string, items: Snapshot[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event(eventName));
  } catch {
    // ignore quota / private mode
  }
}

type Props = {
  handle: string;
  title: string;
  vendor?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  priceAmount?: string | null;
  priceCurrency?: string | null;
};

/**
 * Save + Compare buttons rendered just below the Add-to-cart in the PDP
 * rail. Both are localStorage-backed so the state survives across sessions
 * without requiring an account. The Compare set caps at 4 (matches the
 * floating tray and /compare); the wishlist is unbounded for now.
 *
 * Each button toggles its own state independently. Saved state persists
 * across page navigations via the storage event; if the visitor opens this
 * PDP in a second tab and saves there, the heart fills here too.
 *
 * The save snapshot now captures vendor / image / price so the /wishlist
 * page renders a real card per saved mattress without a server fetch.
 * Older v1 saves missing those fields still toggle correctly — the
 * wishlist renderer falls back to title-only display.
 */
export function PdpCtaRow({
  handle,
  title,
  vendor,
  imageUrl,
  imageAlt,
  priceAmount,
  priceCurrency,
}: Props) {
  const [saved, setSaved] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSaved(readSet(WISHLIST_KEY).some((p) => p.handle === handle));
      setComparing(readSet(COMPARE_KEY).some((p) => p.handle === handle));
    };
    sync();
    setHydrated(true);
    window.addEventListener(COMPARE_EVENT, sync);
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync);
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [handle]);

  const snapshot = (): Snapshot => ({
    handle,
    title,
    vendor: vendor ?? null,
    imageUrl: imageUrl ?? null,
    imageAlt: imageAlt ?? null,
    priceAmount: priceAmount ?? null,
    priceCurrency: priceCurrency ?? null,
  });

  const toggleSave = () => {
    const cur = readSet(WISHLIST_KEY);
    const idx = cur.findIndex((p) => p.handle === handle);
    if (idx >= 0) cur.splice(idx, 1);
    else cur.push(snapshot());
    writeSet(WISHLIST_KEY, WISHLIST_EVENT, cur);
  };

  const toggleCompare = () => {
    const cur = readSet(COMPARE_KEY);
    const idx = cur.findIndex((p) => p.handle === handle);
    if (idx >= 0) {
      cur.splice(idx, 1);
    } else if (cur.length < COMPARE_MAX) {
      cur.push(snapshot());
    } else {
      // Cap reached — silent no-op (visitor sees the floating tray with 4).
      return;
    }
    writeSet(COMPARE_KEY, COMPARE_EVENT, cur);
  };

  // Don't render until hydrated so SSR matches first paint.
  if (!hydrated) return null;

  return (
    <div className="pdp-cta-row">
      <button
        type="button"
        className={`btn btn-ghost pdp-wishlist${saved ? ' is-on' : ''}`}
        onClick={toggleSave}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      >
        <Icon name="heart" size={16} />
        {saved ? 'Saved' : 'Save'}
      </button>
      <button
        type="button"
        className={`btn btn-ghost${comparing ? ' is-on' : ''}`}
        onClick={toggleCompare}
        aria-pressed={comparing}
        aria-label={comparing ? `Remove ${title} from compare` : `Add ${title} to compare`}
      >
        <Icon name={comparing ? 'check' : 'plus'} size={16} />
        {comparing ? 'In compare' : 'Compare'}
      </button>
    </div>
  );
}
