'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';
import { announce } from '@/app/_components/announcer';
import {
  readWishlistSet,
  useWishlistSet,
  writeWishlistSet,
} from '@/app/_components/wishlist-store';
import { formatMoney } from '@/lib/format';
import { formatMonthlyPayment, FINANCING_DEFAULT_MONTHS } from '@/lib/financing-calc';

/**
 * Saved items list — design handoff §Account · Saved items.
 *
 * Reads `la-mattress.wishlist.v1` from localStorage on hydrate, listens
 * for the wishlist-change event so adding/removing on a PDP in another
 * tab updates this view live, and renders a 4-col grid of cards (2-col
 * on tablet, 1-col on mobile).
 *
 * Each card is a real <Link> to the PDP. Image / price fall back to a
 * placeholder when the snapshot was written by an older client (v1
 * saves only had handle + title); newer saves include vendor + image +
 * price. The "Remove" button writes back to localStorage and dispatches
 * the change event so the heart on any open PDP de-fills.
 *
 * The empty state matches the design's `#wishlist` empty composition:
 * eyebrow + headline + browse CTA.
 */
export function WishlistView() {
  // Phase 213: store sync via shared hook.
  const { items, hydrated } = useWishlistSet();

  const remove = (handle: string) => {
    const current = readWishlistSet();
    const target = current.find((p) => p.handle === handle);
    const next = current.filter((p) => p.handle !== handle);
    writeWishlistSet(next);
    announce(target ? `Removed ${target.title} from saved` : 'Removed from saved');
  };

  const clearAll = () => {
    writeWishlistSet([]);
    announce('Cleared saved mattresses');
  };

  if (!hydrated) {
    return (
      <div className="wishlist-grid" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="wishlist-card" aria-hidden="true">
            <div className="wishlist-card-img skel">&nbsp;</div>
            <div className="wishlist-card-body">
              <div className="skel skel-line" style={{ width: '70%' }}>&nbsp;</div>
              <div className="skel skel-line" style={{ width: '40%', marginTop: 8 }}>&nbsp;</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="wishlist-empty">
        <div className="eyebrow">Nothing saved yet</div>
        <h2 className="h2" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>
          Tap the heart on any mattress to save it here.
        </h2>
        <p className="muted" style={{ maxWidth: '52ch', marginBottom: 'var(--s-5)' }}>
          Saved mattresses live in your browser, no account needed. Use it as a shortlist while you decide,
          or share the page with a partner before booking a showroom visit.
        </p>
        <div className="wishlist-empty-actions">
          <Link href="/collections/mattresses" className="btn btn-primary btn-lg">
            Browse mattresses <Icon name="arrow-right" size={14} />
          </Link>
          <Link href="/sleep-quiz" className="btn btn-ghost btn-lg">
            Take the sleep quiz instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="wishlist-toolbar">
        <span className="muted">
          {items.length} saved mattress{items.length === 1 ? '' : 'es'}
        </span>
        <button type="button" className="link-arrow wishlist-clear" onClick={clearAll}>
          Clear all
        </button>
      </div>

      <div className="wishlist-grid">
        {items.map((p) => {
          const price = p.priceAmount && p.priceCurrency
            ? formatMoney({ amount: p.priceAmount, currencyCode: p.priceCurrency })
            : null;
          // Financing line — same affordance the PLP / PDP / cart /
          // quiz result carry. Renders only at the $1,500 Synchrony
          // threshold. Reads from the snapshot we wrote at save time
          // (older v1 saves without priceAmount silently skip — no
          // line, no bug).
          const monthlyLabel = p.priceAmount
            ? formatMonthlyPayment(p.priceAmount, FINANCING_DEFAULT_MONTHS)
            : null;
          return (
            <article key={p.handle} className="wishlist-card">
              <Link href={`/products/${p.handle}`} className="wishlist-card-link">
                <div className="wishlist-card-img">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.imageAlt ?? p.title}
                      fill
                      sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <span className="ph-label">[Saved {p.handle}]</span>
                  )}
                </div>
                <div className="wishlist-card-body">
                  {p.vendor ? <div className="wishlist-card-vendor">{p.vendor}</div> : null}
                  <h3 className="wishlist-card-name">{p.title}</h3>
                  {monthlyLabel ? (
                    <div className="pcard-financing tnum">
                      From <strong>{monthlyLabel}</strong> · 0% APR
                    </div>
                  ) : null}
                  <div className="wishlist-card-foot">
                    {price ? <span className="wishlist-card-price tnum">{price}</span> : <span />}
                    <span className="wishlist-card-cta">
                      View <Icon name="arrow-right" size={12} />
                    </span>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                className="wishlist-remove"
                aria-label={`Remove ${p.title} from saved`}
                onClick={() => remove(p.handle)}
              >
                <Icon name="close" size={14} />
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
