import Link from 'next/link';
import { Icon } from './icon';
import type { HeroSlide } from './hero-slides';
import { HeroController } from './hero-controller';
import { HeroSlideImage } from './hero-slide-image';

/**
 * Homepage hero carousel — server-rendered shell.
 *
 * Phase 195 split: this component is no longer 'use client'. The
 * static slide markup (image, eyebrow, title, body, CTAs, gradient)
 * is server-rendered as plain HTML, with slide 0 marked `.on` /
 * focusable and slides 1+2 marked `aria-hidden` / `inert`. The
 * interactive carousel (autoplay timer, pause state, dot picker,
 * counter, play/pause button, pause-on-hover/focus) lives in the
 * sibling `'use client' HeroController`, which wraps this DOM as
 * children and updates per-slide attributes via querySelector.
 *
 * Image deferral (Phase 162) is preserved through the per-slide
 * `<HeroSlideImage>` wrapper — slide 0 is `eager`, slides 1+2 mount
 * their <Image> only after hydration so the browser doesn't fetch
 * three hero-sized images on initial paint.
 *
 * Net effect: the static slide markup (~120 LOC of JSX) ships as
 * server-rendered HTML rather than client-side React, which trims
 * the homepage's route-specific bundle. Authoring stays single-file
 * (this component) for the static layout, with state isolated in
 * hero-controller.tsx.
 */
export function Hero({
  slides,
  autoplay = true,
  aggregate = null,
}: {
  slides: HeroSlide[];
  autoplay?: boolean;
  /** Sitewide Judge.me aggregate — renders the "★ 4.5 · 11,424 verified
   *  reviews" trust line under the CTAs (CRO review 2026-07-22: the
   *  store's strongest trust asset was buried near the footer). */
  aggregate?: { rating: number; count: number } | null;
}) {
  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
    >
      <HeroController slideCount={slides.length} autoplay={autoplay}>
        <div className="hero-stack">
          {slides.map((s, idx) => (
            <div
              key={idx}
              data-hero-slide={idx}
              className={`hero-slide ${idx === 0 ? 'on' : ''} ${s.accent ? 'hero-slide-accent' : ''}`}
              aria-hidden={idx !== 0 || undefined}
              inert={idx !== 0}
            >
              <div className="hero-bg">
                <HeroSlideImage src={s.bgImage.url} alt={s.bgImage.altText ?? ''} eager={idx === 0} priority={idx === 0} />
              </div>
              <div className="hero-grad" />
              <div className="container hero-content">
                <div className="hero-copy">
                  <div className="eyebrow eyebrow-on-dark">{s.eyebrow}</div>
                  {/* All slides render as <p>, not <h1>. Phase 250 had
                      slide 0 carrying the H1 (and slides 1+ rendering
                      identical .hero-title styling on <p>) so the page
                      had exactly one H1, but the slide title comes
                      from a Shopify metaobject which the merchant
                      controls. Phase 308 SEO audit (Semrush 20260530)
                      flagged the homepage for missing target keywords
                      in the <h1> (`h1_missing_kw` × 4 keywords); we
                      can't fix that by editing slide 0's text without
                      either making the slide title non-merchant-
                      editable or constraining its content. Instead,
                      every slide renders as <p> now and the page's
                      canonical H1 is a code-controlled visually-
                      hidden element at the top of <main> in
                      app/(storefront)/page.tsx, keyword-loaded,
                      deterministic, edited via PR. */}
                  {/* Phase 292 (cowork MEDIUM#11): the \n in the slide
                      title is a visual line break (flex-column .hero-line
                      spans). Trailing space on every non-last line
                      keeps textContent readable across the spans. */}
                  <p className="hero-title" aria-label={s.title.replace(/\n/g, ' ')}>
                    {s.title.split('\n').map((l, j, arr) => (
                      <span key={j} className="hero-line">{j < arr.length - 1 ? `${l} ` : l}</span>
                    ))}
                  </p>
                  <p className="hero-body">{s.body}</p>
                  <div className="hero-ctas">
                    <a className="btn btn-lg btn-on-dark" href={s.primary.href}>
                      {s.primary.label} {s.primary.icon ? <Icon name={s.primary.icon} size={16} /> : null}
                    </a>
                    <a className="btn btn-lg btn-ghost-on-dark" href={s.secondary.href}>{s.secondary.label}</a>
                  </div>
                  {aggregate ? (
                    <Link className="hero-rating" href="/pages/reviews">
                      <Icon name="star" size={14} />
                      <span className="tnum">{aggregate.rating.toFixed(1)}</span>
                      {' · '}
                      <span className="tnum">{aggregate.count.toLocaleString('en-US')}</span> verified reviews
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </HeroController>
    </section>
  );
}
