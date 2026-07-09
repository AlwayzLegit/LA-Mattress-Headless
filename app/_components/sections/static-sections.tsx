import Link from 'next/link';
import { Icon, type IconName } from '../icon';
import { phImg } from '../images';
import { brandLogo } from '@/lib/brand-logos';
import { BrandLogo } from '../brand-logo';
import { getShopAggregate, getStorefrontReviews, reviewerName } from '@/lib/judgeme';
import { getBrands, getFeaturedGuides, getWhyUsItems, getCategoryTiles } from '@/lib/shopify';
import { nonEmptyCollections } from '@/lib/inventory';

/* ───── Shop by category ──────────────────────────────── */
// Live counts from data/url-inventory/collections.json — refreshed on
// every inventory pull, so the homepage tiles never drift from the
// real catalog size. QA audit 2026-05-23 P2-2 caught this: hardcoded
// counts (24/38/19/12/21/14) were all wrong (actual: 61/37/17/38/30/18)
// and the unit mismatch ("bases" vs "styles") was inconsistent. Unified
// to "models" — works for both mattresses and adjustable bases without
// either feeling category-incorrect.
function countLabel(handle: string): string {
  const c = nonEmptyCollections.find((x) => x.handle === handle);
  return c && c.productsCount > 0 ? `${c.productsCount} models` : 'Shop now';
}

/**
 * Hardcoded fallback — used only when the live `shop_by_category_tile`
 * metaobjects fetch returns empty. Merchant adds / reorders / replaces
 * tiles in Shopify Admin → Content → Metaobjects → Shop-by-category
 * tile; ISR picks the change up within an hour.
 */
const FALLBACK_CATEGORIES: { name: string; href: string; imgKey: string | null; countHandle: string | null }[] = [
  { name: 'Memory Foam', href: '/collections/memory-foam-mattresses', imgKey: 'cat-memory-foam', countHandle: 'memory-foam-mattresses' },
  { name: 'Hybrid',      href: '/collections/hybrid-mattresses',      imgKey: 'cat-hybrid',      countHandle: 'hybrid-mattresses' },
  { name: 'Innerspring', href: '/collections/innerspring-mattresses', imgKey: 'cat-innerspring', countHandle: 'innerspring-mattresses' },
  { name: 'Latex',       href: '/collections/latex-mattresses',       imgKey: 'cat-latex',       countHandle: 'latex-mattresses' },
  { name: 'Cooling',     href: '/collections/cooling-mattresses',     imgKey: 'cat-cooling',     countHandle: 'cooling-mattresses' },
  { name: 'Adjustable',  href: '/collections/adjustable-beds',        imgKey: 'cat-adjustable',  countHandle: 'adjustable-beds' },
];

export async function ShopByCategory() {
  const live = await getCategoryTiles();
  const tiles = live.length > 0
    ? live.map((t) => ({ name: t.name, href: t.href, imgKey: t.imgKey, countHandle: t.countCollectionHandle }))
    : FALLBACK_CATEGORIES;
  return (
    <section className="section section-tight">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Shop by Type</div>
            <h2 className="h2">Find your fit.</h2>
          </div>
          <Link href="/collections/mattresses" className="link-arrow">
            All categories <Icon name="arrow-right" size={14} />
          </Link>
        </div>
        <div className="cat-grid">
          {tiles.map((c) => {
            const meta = c.countHandle ? countLabel(c.countHandle) : 'Shop now';
            const placeholderLabel = `[${c.name}]`;
            return (
              <Link href={c.href} key={c.name} className="cat-tile">
                {c.imgKey ? (
                  <div className="ph cat-tile-img" {...phImg(c.imgKey, 'cover', 'warm')}>
                    <span className="ph-label">{placeholderLabel}</span>
                  </div>
                ) : (
                  <div className="ph cat-tile-img" aria-hidden="true" />
                )}
                <div className="cat-tile-meta">
                  <div className="cat-tile-name">{c.name}</div>
                  <div className="cat-tile-sub muted">{meta}</div>
                  <span className="cat-tile-arrow"><Icon name="arrow-up-right" size={16} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───── Brand strip ───────────────────────────────────── */
// Fallback only — the live list comes from getBrands() (derived from
// product vendors + verified brand collections). Used when the
// Storefront API is unconfigured/unreachable so the row never empties.
const FALLBACK_BRANDS: { name: string; href: string }[] = [
  { name: 'Chattam & Wells',  href: '/collections/chattam-wells-mattresses' },
  { name: 'Diamond',          href: '/collections/diamond-mattresses' },
  { name: 'Eastman House',    href: '/collections/eastman-house-mattresses' },
  { name: 'Englander',        href: '/collections/englander-mattresses' },
  { name: 'Harvest Green',    href: '/collections/harvest-mattresses' },
  { name: 'Helix',            href: '/collections/helix-mattresses' },
  { name: 'Spring Air',       href: '/collections/spring-air-mattresses' },
  { name: 'Stearns & Foster', href: '/collections/stearns-foster-mattresses' },
  { name: 'Tempur-Pedic',     href: '/collections/tempur-pedic-mattresses' },
];

// NOTE: the homepage brand strip is intentionally text-wordmark only
// (no logos) — a deliberate "leave homepage as-is" product decision.
// Logos live on /pages/mattress-brands instead. Do not "fix" the
// missing <img>s here; it is not a regression (QA P0-1).
export async function BrandStrip() {
  const live = await getBrands();
  const brands = live.length ? live : FALLBACK_BRANDS;
  return (
    <section className="brand-strip-section">
      <div className="container">
        <div className="brand-strip-head">
          <span className="eyebrow">The brands we carry</span>
          <Link href="/pages/mattress-brands" className="link-arrow link-arrow-sm">
            See all brands <Icon name="arrow-right" size={12} />
          </Link>
        </div>
        <div className="brand-strip">
          {brands.map((b) => {
            // Handle derives from the collection href so this works for both
            // the live getBrands() shape and the wordmark-only fallback.
            const handle = b.href.replace('/collections/', '');
            const logo = brandLogo(handle);
            return (
              <Link href={b.href} key={b.href} className={`brand-tile${logo ? ' brand-tile-logo' : ''}`}>
                {logo ? (
                  <span className="brand-strip-logo">
                    <BrandLogo
                      src={logo.src}
                      alt={logo.alt ?? `${b.name} logo`}
                      width={logo.width}
                      height={logo.height}
                      name={b.name}
                    />
                  </span>
                ) : (
                  <span className="brand-wordmark">{b.name}</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───── Featured guides ──────────────────────────────────
 * SEMrush 20260521_1 follow-up — surfaces the cornerstone buying-guide
 * articles from the homepage, the highest-PageRank page on the site.
 * Adds substantial inbound link equity to each article and pulls the
 * cluster out of the crawl-depth tail (articles previously needed
 * 3+ clicks from home — nav Guides mega → blog index → list →
 * article). Curated (no Shopify fetch needed); same wordmark-strip
 * pattern as BrandStrip above for visual consistency. */
/**
 * Hardcoded fallback — used only when the live `featured_guide`
 * metaobjects fetch returns empty (Shopify unconfigured, unreachable,
 * or the metaobject definition wasn't seeded). Merchant adds /
 * reorders entries in Shopify Admin → Content → Metaobjects →
 * Featured guide; ISR picks the change up within an hour.
 */
const FALLBACK_FEATURED_GUIDES: { label: string; href: string }[] = [
  { label: 'Best mattress in Los Angeles',          href: '/blogs/mattress-buying-guide/best-mattress-los-angeles' },
  { label: 'How to choose a mattress',              href: '/blogs/mattress-buying-guide/how-to-choose-a-mattress' },
  { label: 'Best for back pain',                    href: '/blogs/mattress-buying-guide/best-mattress-for-back-pain' },
  { label: 'Best for side sleepers',                href: '/blogs/mattress-buying-guide/best-mattress-for-side-sleepers' },
  { label: 'How much to spend',                     href: '/blogs/mattress-buying-guide/how-much-should-you-spend-on-a-mattress' },
  { label: 'Mattress sizes explained',              href: '/blogs/mattress-buying-guide/how-to-choose-the-best-mattress-size' },
];

export async function FeaturedGuides() {
  const live = await getFeaturedGuides();
  const guides = live.length > 0
    ? live.map((g) => ({ label: g.label, href: g.href }))
    : FALLBACK_FEATURED_GUIDES;
  return (
    <section className="brand-strip-section">
      <div className="container">
        <div className="brand-strip-head">
          <span className="eyebrow">Read before you buy</span>
          <Link href="/blogs" className="link-arrow link-arrow-sm">
            All buying guides <Icon name="arrow-right" size={12} />
          </Link>
        </div>
        <div className="brand-strip">
          {guides.map((g) => (
            <Link href={g.href} key={g.href} className="brand-tile">
              <span className="brand-wordmark">{g.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── Why LA Mattress ───────────────────────────────── */

/**
 * Hardcoded fallback — used only when live `why_us_item` metaobjects
 * fetch returns empty. Merchant adds / edits in Shopify Admin →
 * Content → Metaobjects → Why us item.
 */
const FALLBACK_WHY_US: { n: string; title: string; body: string }[] = [
  { n: '01', title: 'Local for 14 years.',         body: 'Family-owned and operated since 2012. Five LA showrooms, real people on every call — no chatbots, no overseas support.' },
  { n: '02', title: 'No pressure, no script.',     body: 'Our sleep consultants know every brand on the floor — real advice, never a hard sell. Lie down as long as you want, leave when you want.' },
  { n: '03', title: 'Same-day to all of LA.',      body: 'White-glove delivery, mattress setup, and old mattress haul-away — all included on every order over $499. Order by 4pm for same-day.' },
  { n: '04', title: 'Real return policy.',         body: '120-night sleep trial. If it’s not right, one comfort exchange gets you any other mattress we stock — no restocking fee.' },
];

// Decorative icon per value-prop slot (#13). Indexed by position so it
// stays sensible whether items come from the CMS or the fallback above:
// local → home, advice → chat, delivery → truck, returns → shield.
const WHY_ICONS = ['home', 'chat', 'truck', 'shield'] as const;

export async function WhyUs() {
  const live = await getWhyUsItems();
  const items = live.length > 0
    ? live.map((w) => ({ n: w.eyebrow || String(w.displayOrder).padStart(2, '0'), title: w.title, body: w.body }))
    : FALLBACK_WHY_US;
  return (
    <section className="section why-us">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Why LA Mattress</div>
            <h2 className="h2">Built for the way<br />Angelenos sleep.</h2>
          </div>
        </div>
        <div className="why-grid">
          {items.map((it, i) => (
            <div key={it.n} className="why-item">
              <div className="why-item-top">
                <span className="why-icon" aria-hidden="true">
                  <Icon name={WHY_ICONS[i] ?? 'sparkle'} size={22} />
                </span>
                <span className="mono why-n">{it.n}</span>
              </div>
              <h3 className="h3">{it.title}</h3>
              <p className="muted">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* QuizTeaser was retired in favor of the WaysToFindMatch tri-card
   section — see app/_components/sections/ways-to-find-match.tsx. The
   single-CTA "Answer 8 questions" panel was redundant once the
   homepage hero lead-in surfaced the quiz above the fold and the
   primary nav slot landed in #284; the new section pairs the quiz
   with chat + showroom as three distinct discovery paths. */

/* ───── Reviews ──────────────────────────────────────────
 *
 * Pulls the latest 6 verified 4★+ reviews from Judge.me's public API server-
 * side. Renders nothing when:
 *   - JUDGEME_API_TOKEN / JUDGEME_SHOP_DOMAIN env vars aren't set, or
 *   - Judge.me has zero published reviews matching the filter.
 *
 * Both branches return null without rendering an empty section, so the page
 * stays clean during onboarding. See lib/judgeme.ts.
 */
export async function Reviews() {
  const [aggregate, reviews] = await Promise.all([
    getShopAggregate(),
    getStorefrontReviews({ perPage: 6, minRating: 4 }),
  ]);
  if (!aggregate || reviews.length === 0) return null;

  return (
    <section className="section reviews-home">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Real customers, real beds</div>
            <h2 className="h2">{aggregate.rating.toFixed(1)} stars from {aggregate.count.toLocaleString()} verified reviews</h2>
          </div>
          <div className="section-head-right">
            <Link href="/pages/reviews" className="link-arrow">
              Read all reviews <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        </div>
        <ul className="reviews-home-grid" aria-label="Recent customer reviews">
          {reviews.slice(0, 6).map((r) => (
            <li key={r.id} className="reviews-home-card">
              <div className="reviews-home-card-rating" aria-label={`${r.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < r.rating ? 'review-star-on' : 'review-star-off'}>
                    <Icon name="star" size={14} />
                  </span>
                ))}
              </div>
              {r.title ? <h3 className="reviews-home-card-title">{r.title}</h3> : null}
              <p className="reviews-home-card-body">{r.body.length > 220 ? r.body.slice(0, 217) + '…' : r.body}</p>
              <div className="reviews-home-card-meta muted">
                {reviewerName(r)} · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
