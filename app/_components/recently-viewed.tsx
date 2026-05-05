'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product, ProductSummary } from '@/lib/shopify';
import { formatPriceRange } from '@/lib/format';

const KEY = 'la-mattress.recently-viewed.v1';
const MAX = 12;

type StoredItem = {
  handle: string;
  title: string;
  vendor: string;
  imgUrl: string | null;
  imgAlt: string | null;
  priceMin: { amount: string; currencyCode: string };
  priceMax: { amount: string; currencyCode: string };
  ts: number;
};

function readStore(): StoredItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is StoredItem => typeof x === 'object' && x != null && 'handle' in x);
  } catch {
    return [];
  }
}

function writeStore(items: StoredItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // localStorage quota or disabled — silently no-op.
  }
}

/**
 * Records the current PDP into recently-viewed localStorage on mount.
 * Renders nothing. Drop into the PDP and any product detail surface.
 */
export function RecordRecentlyViewed({ product }: { product: Product }) {
  useEffect(() => {
    const item: StoredItem = {
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      imgUrl: product.featuredImage?.url ?? null,
      imgAlt: product.featuredImage?.altText ?? null,
      priceMin: {
        amount: product.priceRange.minVariantPrice.amount,
        currencyCode: product.priceRange.minVariantPrice.currencyCode,
      },
      priceMax: {
        amount: product.priceRange.maxVariantPrice.amount,
        currencyCode: product.priceRange.maxVariantPrice.currencyCode,
      },
      ts: Date.now(),
    };
    const existing = readStore().filter((p) => p.handle !== product.handle);
    writeStore([item, ...existing]);
  }, [product]);
  return null;
}

/**
 * Horizontal rail of the visitor's recently-viewed products. Hides itself
 * when the store is empty or contains only one item — a single-item rail
 * is awkward and reads as repetition on the PDP that just recorded it.
 *
 * `excludeHandle` skips the current product so the PDP doesn't show itself.
 */
export function RecentlyViewedRail({
  excludeHandle,
  heading = 'Recently viewed',
  eyebrow = 'Pick up where you left off',
}: {
  excludeHandle?: string;
  heading?: string;
  eyebrow?: string;
}) {
  const [items, setItems] = useState<StoredItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setItems(readStore());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  const filtered = excludeHandle ? items.filter((p) => p.handle !== excludeHandle) : items;
  if (filtered.length < 2) return null;

  return (
    <section className="section pdp-related" aria-labelledby="recently-viewed-heading">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 id="recently-viewed-heading" className="h2">{heading}</h2>
          </div>
        </div>
      </div>
      <div className="pcard-scroll-wrap">
        <div className="pcard-scroll no-scrollbar">
          {filtered.map((p) => {
            const summary: Pick<ProductSummary, 'priceRange'> = {
              priceRange: {
                minVariantPrice: p.priceMin,
                maxVariantPrice: p.priceMax,
              },
            };
            return (
              <Link key={p.handle} href={`/products/${p.handle}`} className="pcard pcard-rail">
                <div className="ph pcard-img" style={{ aspectRatio: '1' }}>
                  {p.imgUrl ? (
                    <Image
                      src={p.imgUrl}
                      alt={p.imgAlt ?? p.title}
                      width={400}
                      height={400}
                      sizes="(max-width: 760px) 60vw, 240px"
                      style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                      loading="lazy"
                    />
                  ) : <span className="ph-label">[Image coming]</span>}
                </div>
                <div className="pcard-meta">
                  <div className="pcard-brand">{p.vendor}</div>
                  <div className="pcard-name">{p.title}</div>
                  <div className="pcard-price">
                    <span className="pcard-now tnum">
                      {formatPriceRange(summary.priceRange.minVariantPrice, summary.priceRange.maxVariantPrice)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
