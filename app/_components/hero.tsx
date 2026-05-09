'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Icon, type IconName } from './icon';
import { imgUrl } from './images';

type Slide = {
  kind: 'showroom' | 'product' | 'sale';
  eyebrow: string;
  title: string;
  body: string;
  primary: { label: string; icon?: IconName; href: string };
  secondary: { label: string; href: string };
  bgLabel: string;
  bgImg: string;
  accent?: boolean;
};

const HERO_SLIDES: Slide[] = [
  {
    kind: 'showroom',
    eyebrow: '5 LA Showrooms',
    title: 'Try before\nyou buy.',
    body: 'Lie down on every mattress we sell, in person, at a showroom near you. Open daily across Los Angeles.',
    primary:   { label: 'Find a store',         icon: 'pin',         href: '/pages/mattress-store-locations' },
    secondary: { label: 'Book an appointment',                       href: '/pages/mattress-store-contact' },
    bgLabel: '[Koreatown showroom interior]',
    bgImg: 'hero-showroom',
  },
  {
    kind: 'product',
    eyebrow: 'Premium Brands · Same-Day Delivery',
    title: 'Sleep, engineered\nin Los Angeles.',
    body: 'Tempur-Pedic, Stearns & Foster, Helix, Diamond and more — delivered to your door, often the same day.',
    primary:   { label: 'Shop mattresses',     icon: 'arrow-right', href: '/collections/mattresses' },
    secondary: { label: 'Take the 2-min quiz',                      href: '/sleep-quiz' },
    bgLabel: '[Brand lifestyle bedroom]',
    bgImg: 'lifestyle-bedroom',
  },
  {
    kind: 'sale',
    eyebrow: 'Memorial Day Event',
    title: 'Up to\n60% off.',
    body: 'Markdowns on every floor model, plus free upgrades on king sizes. Limited stock at every showroom.',
    primary:   { label: 'Shop the sale',  icon: 'arrow-right', href: '/collections/on-sale' },
    secondary: { label: 'See all deals',                       href: '/collections/floor-model-discontinued-mattress-clearance-sale' },
    bgLabel: '[Sale event composition]',
    bgImg: 'lifestyle-couple',
    accent: true,
  },
];

export function Hero({ autoplay = true }: { autoplay?: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!autoplay || paused) return;
    const t = setTimeout(() => setI((v) => (v + 1) % HERO_SLIDES.length), 7000);
    return () => clearTimeout(t);
  }, [i, autoplay, paused]);

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Keyboard equivalent of the hover-pause: when a CTA inside the
      // active slide takes focus, freeze autoplay so the slide doesn't
      // swap out from under a keyboard user mid-tab. relatedTarget is
      // the element receiving focus — null when leaving the page
      // entirely. The currentTarget.contains check makes blur fire only
      // when focus exits the carousel subtree, not on intra-carousel
      // tabs (otherwise pause would flicker on/off per Tab keystroke).
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className="hero-stack">
        {HERO_SLIDES.map((s, idx) => (
          <div
            key={idx}
            className={`hero-slide ${idx === i ? 'on' : ''} ${s.accent ? 'hero-slide-accent' : ''}`}
            aria-hidden={idx !== i}
            inert={idx !== i}
          >
            <div className="hero-bg">
              <Image
                src={imgUrl(s.bgImg)}
                alt=""
                fill
                priority={idx === 0}
                fetchPriority={idx === 0 ? 'high' : 'auto'}
                sizes="100vw"
                quality={75}
                className="hero-bg-img"
              />
            </div>
            <div className="hero-grad" />
            <div className="container hero-content">
              <div className="hero-copy">
                <div className="eyebrow eyebrow-on-dark">{s.eyebrow}</div>
                <h1 className="hero-title">
                  {s.title.split('\n').map((l, j) => <span key={j} className="hero-line">{l}</span>)}
                </h1>
                <p className="hero-body">{s.body}</p>
                <div className="hero-ctas">
                  <a className="btn btn-lg btn-on-dark" href={s.primary.href}>
                    {s.primary.label} {s.primary.icon ? <Icon name={s.primary.icon} size={16} /> : null}
                  </a>
                  <a className="btn btn-lg btn-ghost-on-dark" href={s.secondary.href}>{s.secondary.label}</a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hero-controls container">
        {/*
          Carousel dot group. Per WAI-ARIA APG carousel pattern:
          - role="group" + aria-label so the dots are programmatically
            identified as the slide picker, not just a row of buttons.
          - Roving tabindex: only the active dot is in the tab order;
            ArrowLeft/Right move to the prev/next dot. So a keyboard
            user can cycle slides without tabbing through three buttons.
            Home/End jump to first/last slide.
        */}
        <div
          className="hero-progress"
          role="group"
          aria-label="Choose hero slide"
          onKeyDown={(e) => {
            // Modulo form so left/right wrap symmetrically. The
            // earlier ternary form (Phase 141) tested correct on
            // paper but the Cowork retest caught ArrowLeft-from-0
            // not wrapping to last. Rewriting as modulo eliminates
            // any subtle branch asymmetry and is cheap.
            const total = HERO_SLIDES.length;
            let next: number | null = null;
            if (e.key === 'ArrowRight') next = (i + 1) % total;
            else if (e.key === 'ArrowLeft') next = (i - 1 + total) % total;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = total - 1;
            if (next === null) return;
            e.preventDefault();
            setI(next);
            const dots = e.currentTarget.querySelectorAll<HTMLButtonElement>('.hero-dot');
            dots[next]?.focus();
          }}
        >
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`hero-dot ${idx === i ? 'on' : ''}`}
              onClick={() => setI(idx)}
              aria-label={`Slide ${idx + 1} of ${HERO_SLIDES.length}`}
              aria-current={idx === i ? 'true' : undefined}
              tabIndex={idx === i ? 0 : -1}
            >
              <span className="hero-dot-bar">
                <span className="hero-dot-fill" style={{ animationPlayState: paused ? 'paused' : 'running' }} />
              </span>
            </button>
          ))}
        </div>
        <div className="hero-meta">
          <span className="mono hero-counter">{String(i + 1).padStart(2, '0')} / {String(HERO_SLIDES.length).padStart(2, '0')}</span>
          <button
            type="button"
            className="hero-pause"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play hero carousel' : 'Pause hero carousel'}
            aria-pressed={paused}
          >
            <Icon name={paused ? 'play' : 'pause'} size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
