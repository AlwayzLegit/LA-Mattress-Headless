import { Icon } from './icon';
import { imgUrl } from './images';
import { HERO_SLIDES } from './hero-slides';
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
export function Hero({ autoplay = true }: { autoplay?: boolean }) {
  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
    >
      <HeroController slideCount={HERO_SLIDES.length} autoplay={autoplay}>
        <div className="hero-stack">
          {HERO_SLIDES.map((s, idx) => (
            <div
              key={idx}
              data-hero-slide={idx}
              className={`hero-slide ${idx === 0 ? 'on' : ''} ${s.accent ? 'hero-slide-accent' : ''}`}
              aria-hidden={idx !== 0 || undefined}
              inert={idx !== 0}
            >
              <div className="hero-bg">
                <HeroSlideImage src={imgUrl(s.bgImg)} eager={idx === 0} priority={idx === 0} />
              </div>
              <div className="hero-grad" />
              <div className="container hero-content">
                <div className="hero-copy">
                  <div className="eyebrow eyebrow-on-dark">{s.eyebrow}</div>
                  {/* Phase 250: only slide 0 renders as <h1> so the page has
                      exactly one h1 for SEO. Slides 1+ render the same
                      .hero-title styling on a <p> so they look identical when
                      the hero rotates client-side (aria-hidden + inert above
                      already remove them from the a11y tree). Cowork rev-7
                      flagged SEMrush "Multiple h1 tags" on the homepage,
                      caused by all 3 slide h1s being in the DOM at once. */}
                  {idx === 0 ? (
                    <h1 className="hero-title" aria-label={s.title.replace(/\n/g, ' ')}>
                      {s.title.split('\n').map((l, j) => (
                        <span key={j} className="hero-line">{l}</span>
                      ))}
                    </h1>
                  ) : (
                    <p className="hero-title" aria-label={s.title.replace(/\n/g, ' ')}>
                      {s.title.split('\n').map((l, j) => (
                        <span key={j} className="hero-line">{l}</span>
                      ))}
                    </p>
                  )}
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
      </HeroController>
    </section>
  );
}
