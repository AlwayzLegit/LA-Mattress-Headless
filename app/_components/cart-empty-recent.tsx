'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icon';
import { formatMoney } from '@/lib/format';

const KEY = 'la-mattress.recently-viewed.v1';

type StoredItem = {
  handle: string;
  title: string;
  vendor: string;
  imgUrl: string | null;
  imgAlt: string | null;
  priceMin: { amount: string; currencyCode: string };
};

/**
 * "Last viewed" card surfaced below the cart-drawer empty state. Pulls
 * the most recent recently-viewed entry (set #1 in the list since the
 * record-rail effect prepends new entries). Provides a one-click route
 * back to the PDP the visitor was last on — bringing them back into
 * the consideration funnel instead of leaving them with a generic
 * "Browse mattresses" link.
 *
 * Hidden until hydrate (SSR shell stays empty) and hidden when the
 * recently-viewed store is empty so first-ever visitors still see the
 * existing browse CTA without a stale placeholder.
 *
 * `onNavigate` lets the parent close the cart drawer when the visitor
 * clicks through to the PDP.
 */
export function CartEmptyRecent({ onNavigate }: { onNavigate?: () => void }) {
  const [item, setItem] = useState<StoredItem | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr) || arr.length === 0) return;
      const first = arr[0] as StoredItem;
      if (first && typeof first.handle === 'string') setItem(first);
    } catch {
      // ignore quota / private mode / parse errors
    }
  }, []);

  if (!item) return null;

  return (
    <div className="cart-empty-recent">
      <div className="eyebrow">Last viewed</div>
      <Link
        href={`/products/${item.handle}`}
        className="cart-empty-recent-card"
        onClick={onNavigate}
      >
        <div className="cart-empty-recent-img">
          {item.imgUrl ? (
            <Image
              src={item.imgUrl}
              alt={item.imgAlt ?? item.title}
              fill
              sizes="64px"
              style={{ objectFit: 'contain' }}
            />
          ) : null}
        </div>
        <div className="cart-empty-recent-meta">
          <div className="cart-empty-recent-vendor">{item.vendor}</div>
          <div className="cart-empty-recent-title">{item.title}</div>
          <div className="cart-empty-recent-price tnum">
            {formatMoney(item.priceMin)}
          </div>
        </div>
        <Icon name="arrow-right" size={14} />
      </Link>
    </div>
  );
}
