import Link from 'next/link';
import { Icon, type IconName } from '../icon';
import { phImg } from '../images';

/* ───── Trust bar ─────────────────────────────────────── */
export function TrustBar() {
  const items: { icon: IconName; label: string; sub: string }[] = [
    { icon: 'shield', label: '120-night comfort exchange', sub: 'Sleep on it for 4 months' },
    { icon: 'truck',  label: 'Free white glove delivery',   sub: 'Setup & old mattress haul-away' },
    { icon: 'home',   label: 'Family-owned since 2012',     sub: '5 showrooms across LA' },
    { icon: 'card',   label: '0% APR financing',             sub: 'Up to 60 months, no fees' },
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
    { n: '01', title: 'Local for 14 years.',         body: 'Family-owned and operated since 2012. Five showrooms, one phone number, real people.' },
    { n: '02', title: 'No pressure, no script.',     body: 'Our consultants work on salary — not commission. Lie down as long as you want, leave when you want.' },
    { n: '03', title: 'Same-day to most of LA.',     body: 'White glove delivery, mattress setup, and old mattress haul-away — included on every order over $799.' },
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
          Answer 6 questions.<br />Get a real recommendation.
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

/* ───── Reviews ───────────────────────────────────────── */
const REVIEWS = [
  { name: 'Marcela R.', loc: 'Silver Lake',   body: 'Honestly the most pleasant mattress-buying experience I’ve ever had. Tried six in the showroom, walked out with the right one. Delivered the next day.', rating: 5, src: 'Google · Koreatown' },
  { name: 'David K.',   loc: 'Studio City',   body: 'No commission means no pushy salespeople. The team helped me compare three Tempur-Pedics side by side and pointed me to the cheaper one that was actually better for my back.', rating: 5, src: 'Google · Studio City' },
  { name: 'Priya N.',   loc: 'West LA',       body: 'White glove delivery was on time, took the old one away, set up the new one in 15 minutes. The financing was 0% — I paid less than I expected.', rating: 5, src: 'Google · West LA' },
  { name: 'Jaime O.',   loc: 'Glendale',      body: 'I tried it for 90 nights and exchanged for a firmer one. Zero hassle. They picked up the first one and dropped off the new one same day.', rating: 5, src: 'Google · Glendale' },
  { name: 'Sara L.',    loc: 'Hancock Park',  body: 'Spent two hours in the showroom on a Saturday. They brought me water. I wasn’t even ready to buy. Came back two weeks later, they remembered me by name.', rating: 5, src: 'Google · Hancock Park' },
  { name: 'Alex T.',    loc: 'DTLA',          body: 'Family business. You can tell. They actually answer the phone.', rating: 5, src: 'Google · Koreatown' },
];

export function Reviews() {
  return (
    <section className="section reviews">
      <div className="container">
        <div className="section-head reviews-head">
          <div>
            <div className="eyebrow">Reviews</div>
            <h2 className="h2">4.9 stars on Google,<br />3,300+ reviews.</h2>
          </div>
          <div className="reviews-summary">
            <div className="reviews-stars">
              {Array.from({ length: 5 }).map((_, i) => <Icon key={i} name="star" size={18} />)}
            </div>
            <div className="muted reviews-summary-sub">Verified across 5 LA locations</div>
          </div>
        </div>
        <div className="reviews-grid">
          {REVIEWS.map((r, i) => (
            <article key={i} className="review">
              <div className="review-stars">
                {Array.from({ length: r.rating }).map((_, j) => <Icon key={j} name="star" size={13} />)}
              </div>
              <p className="review-body">&ldquo;{r.body}&rdquo;</p>
              <div className="review-foot">
                <div>
                  <div className="review-name">{r.name}</div>
                  <div className="muted review-loc">{r.loc}</div>
                </div>
                <div className="muted mono review-src">{r.src}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
