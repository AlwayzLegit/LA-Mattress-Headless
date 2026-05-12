import Link from 'next/link';
import { Icon, type IconName } from '../icon';
import { phImg } from '../images';
import { getShopAggregate, getStorefrontReviews } from '@/lib/judgeme';

/* ───── Trust bar ─────────────────────────────────────── */
export function TrustBar() {
  const items: { icon: IconName; label: string; sub: string }[] = [
    { icon: 'shield', label: '120-night comfort exchange', sub: 'Sleep on it for 4 months' },
    { icon: 'truck',  label: 'Free white-glove delivery',   sub: 'Setup & old mattress haul-away' },
    { icon: 'home',   label: 'Family-owned since 2012',     sub: '5 showrooms across LA' },
    { icon: 'card',   label: '0% APR financing',             sub: 'Synchrony & Acima · no fees' },
  ];
  return (
    <section className="trust-bar">
      <div className="container trust-bar-inner">
        {items.map((it) => (
          <div key={it.label} className="trust-item">
            <div className="trust-ico"><Icon name={it.icon} size={22} stroke={1.4} /></div>
            <div>
              <div className="trust-label">{it.label}</div>
              <div className="trust-sub muted">{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───── Shop by category ──────────────────────────────── */
const CATEGORIES: { name: string; meta: string; img: string; label: string; href: string }[] = [
  { name: 'Memory Foam', meta: '24 styles', img: 'cat-memory-foam', label: '[Memory foam]',   href: '/collections/memory-foam-mattresses' },
  { name: 'Hybrid',      meta: '38 styles', img: 'cat-hybrid',      label: '[Hybrid]',         href: '/collections/hybrid-mattresses' },
  { name: 'Innerspring', meta: '19 styles', img: 'cat-innerspring', label: '[Innerspring]',    href: '/collections/innerspring-mattresses' },
  { name: 'Latex',       meta: '12 styles', img: 'cat-latex',       label: '[Latex]',          href: '/collections/latex-mattresses' },
  { name: 'Cooling',     meta: '21 styles', img: 'cat-cooling',     label: '[Cooling]',        href: '/collections/cooling-mattresses' },
  { name: 'Adjustable',  meta: '14 bases',  img: 'cat-adjustable',  label: '[Adjustable base]',href: '/collections/adjustable-beds' },
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
const BRANDS: { name: string; href: string }[] = [
  { name: 'Tempur-Pedic',     href: '/collections/tempur-pedic-mattresses' },
  { name: 'Stearns & Foster', href: '/collections/stearns-foster-mattresses' },
  { name: 'Diamond',          href: '/collections/diamond-mattresses' },
  { name: 'Helix',            href: '/collections/helix-mattresses' },
  { name: 'Spring Air',       href: '/collections/spring-air-mattresses' },
  { name: 'Eastman House',    href: '/collections/eastman-house-mattresses' },
  { name: 'Harvest Green',    href: '/collections/harvest-mattresses' },
  { name: 'Englander',        href: '/collections/englander-mattresses' },
  { name: 'Chattam & Wells',  href: '/collections/chattam-wells-mattresses' },
];

export function BrandStrip() {
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
          {BRANDS.map((b) => (
            <Link href={b.href} key={b.name} className="brand-tile">
              <span className="brand-wordmark">{b.name}</span>
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
