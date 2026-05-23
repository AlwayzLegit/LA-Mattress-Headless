import Link from 'next/link';
import { Icon, type IconName } from '../icon';
import { phImg } from '../images';
import { getShopAggregate, getStorefrontReviews } from '@/lib/judgeme';
import { getBrands } from '@/lib/shopify';
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

const CATEGORIES: { name: string; meta: string; img: string; label: string; href: string }[] = [
  { name: 'Memory Foam', meta: countLabel('memory-foam-mattresses'), img: 'cat-memory-foam', label: '[Memory foam]',   href: '/collections/memory-foam-mattresses' },
  { name: 'Hybrid',      meta: countLabel('hybrid-mattresses'),      img: 'cat-hybrid',      label: '[Hybrid]',         href: '/collections/hybrid-mattresses' },
  { name: 'Innerspring', meta: countLabel('innerspring-mattresses'), img: 'cat-innerspring', label: '[Innerspring]',    href: '/collections/innerspring-mattresses' },
  { name: 'Latex',       meta: countLabel('latex-mattresses'),       img: 'cat-latex',       label: '[Latex]',          href: '/collections/latex-mattresses' },
  { name: 'Cooling',     meta: countLabel('cooling-mattresses'),     img: 'cat-cooling',     label: '[Cooling]',        href: '/collections/cooling-mattresses' },
  { name: 'Adjustable',  meta: countLabel('adjustable-beds'),        img: 'cat-adjustable',  label: '[Adjustable base]',href: '/collections/adjustable-beds' },
];

export function ShopByCategory() {
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
          {CATEGORIES.map((c) => (
            <Link href={c.href} key={c.name} className="cat-tile">
              <div className="ph cat-tile-img" {...phImg(c.img, 'cover', 'warm')}>
                <span className="ph-label">{c.label}</span>
              </div>
              <div className="cat-tile-meta">
                <div className="cat-tile-name">{c.name}</div>
                <div className="cat-tile-sub muted">{c.meta}</div>
                <span className="cat-tile-arrow"><Icon name="arrow-up-right" size={16} /></span>
              </div>
            </Link>
          ))}
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
          {brands.map((b) => (
            <Link href={b.href} key={b.href} className="brand-tile">
              <span className="brand-wordmark">{b.name}</span>
            </Link>
          ))}
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
const FEATURED_GUIDES: { label: string; href: string }[] = [
  { label: 'Best mattress in Los Angeles',          href: '/blogs/mattress-buying-guide/best-mattress-los-angeles' },
  { label: 'How to choose a mattress',              href: '/blogs/mattress-buying-guide/how-to-choose-a-mattress' },
  { label: 'Best for back pain',                    href: '/blogs/mattress-buying-guide/best-mattress-for-back-pain' },
  { label: 'Best for side sleepers',                href: '/blogs/mattress-buying-guide/best-mattress-for-side-sleepers' },
  { label: 'How much to spend',                     href: '/blogs/mattress-buying-guide/how-much-should-you-spend-on-a-mattress' },
  { label: 'Mattress sizes explained',              href: '/blogs/mattress-buying-guide/how-to-choose-the-best-mattress-size' },
];

export function FeaturedGuides() {
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
          {FEATURED_GUIDES.map((g) => (
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
export function WhyUs() {
  const items = [
    { n: '01', title: 'Local for 14 years.',         body: 'Family-owned and operated since 2012. Five LA showrooms, real people on every call — no chatbots, no overseas support.' },
    { n: '02', title: 'No pressure, no script.',     body: 'Our consultants work on salary — not commission. Lie down as long as you want, leave when you want.' },
    { n: '03', title: 'Same-day to all of LA.',      body: 'White-glove delivery, mattress setup, and old mattress haul-away — all included on every order over $499. Order by 4pm for same-day.' },
    { n: '04', title: 'Real return policy.',         body: '120 nights to decide. If it’s not right, we’ll exchange it for free — no restocking fee.' },
  ];
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
          {items.map((it) => (
            <div key={it.n} className="why-item">
              <div className="mono why-n">{it.n}</div>
              <h3 className="h3">{it.title}</h3>
              <p className="muted">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── Quiz teaser ───────────────────────────────────── */
export function QuizTeaser() {
  return (
    <section className="section section-dark quiz-teaser">
      <div className="ph ph-dark quiz-bg" {...phImg('lifestyle-bedroom', 'cover')}>
        <span className="ph-label">[Bedroom ambient]</span>
      </div>
      <div className="quiz-grad" />
      <div className="container quiz-content">
        <div className="eyebrow eyebrow-on-dark">2-minute mattress quiz</div>
        <h2 className="h-display quiz-title">
          Answer 8 questions.<br />Get a real recommendation.
        </h2>
        <p className="muted quiz-body">
          No email required. We narrow our 200+ models down to the three best for how you actually sleep.
        </p>
        <div className="quiz-ctas">
          <a className="btn btn-lg btn-on-dark" href="/sleep-quiz">
            Start the quiz <Icon name="arrow-right" size={16} />
          </a>
          <Link href="/collections/mattresses" className="link-arrow link-arrow-on-dark">
            Or browse all mattresses <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

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
                {r.reviewer.name || 'Anonymous'} · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
