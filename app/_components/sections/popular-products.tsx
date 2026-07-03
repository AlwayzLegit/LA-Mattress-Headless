// Phase 292: real Storefront data. Previously this rendered a hardcoded
// PRODUCTS sample with placeholder images, fake prices, and no star
// ratings ("Real Storefront product data swap comes in Phase 1" — never
// done). The merchant flagged that homepage product cards lacked the
// review widget; the root cause was that they weren't real products at
// all. Now fetches the live `popular` collection and renders the shared
// PlpCard, which brings real imagery, real prices, sale display, and the
// ReviewsBadge for free — parity with the collection grid.
//
// Async server component. Only the scroll-button island hydrates; the
// cards stay server-only (PlpCard is server-friendly). Resilient: if
// Shopify is unconfigured or the fetch fails/returns empty, the section
// renders nothing rather than crashing the homepage (same null-render
// discipline as the Reviews section).

import Link from 'next/link';
import { Icon } from '../icon';
import { getCollectionByHandle } from '@/lib/shopify';
import { PlpCard } from '../plp-card';
import { RailScrollButtons } from './rail-scroll-buttons';

const RAIL_ID = 'popular-products-rail';

export async function PopularProducts() {
  const collection = await getCollectionByHandle({
    handle: 'popular',
    first: 12,
    sortKey: 'BEST_SELLING',
  }).catch(() => null);

  const products = collection?.products.nodes ?? [];
  if (products.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Popular Now</div>
            <h2 className="h2">Most-shopped mattresses<br />this month.</h2>
          </div>
          <div className="section-head-right">
            <Link href="/collections/popular" className="link-arrow">Shop all popular mattresses <Icon name="arrow-right" size={14} /></Link>
            <RailScrollButtons
              railId={RAIL_ID}
              leftLabel="Scroll popular mattresses left"
              rightLabel="Scroll popular mattresses right"
            />
          </div>
        </div>
      </div>
      <div className="pcard-scroll-wrap">
        <div id={RAIL_ID} className="pcard-scroll no-scrollbar">
          {products.map((p) => (
            // No priority: this rail starts ~880px below the fold, so
            // high-priority preloads here competed with the hero LCP
            // image (audit perf-img-08). PLPs keep priority on their
            // first cards, where they ARE the LCP candidates.
            <PlpCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
