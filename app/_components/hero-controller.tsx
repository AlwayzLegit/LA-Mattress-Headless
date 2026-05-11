'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';

const SLIDE_INTERVAL_MS = 7000;

/**
 * Client-side controller for the Hero carousel.
 *
 * Phase 195 split: the Hero component is now a server component that
 * renders the static slide DOM (3 slides, slide 0 marked `.on`). This
 * controller wraps that DOM as `children` and owns:
 *   - current slide index (`i`) + paused state
 *   - autoplay timer (7s interval, freezes when `paused`)
 *   - pause-on-hover / pause-on-focus on the carousel subtree
 *   - dot picker with WAI-ARIA roving tabindex (Arrow / Home / End)
 *   - counter readout (NN / NN)
 *   - manual play/pause button
 *
 * On mount and whenever `i` changes, the controller updates the
 * server-rendered slide DOM via querySelector — toggling the `.on`
 * class, `aria-hidden`, and `inert` per slide. This keeps the static
 * markup out of the client bundle while still letting the controller
 * drive the cross-fade and carousel-correct AT semantics.
 *
 * Wrapper uses `display: contents` so it doesn't introduce a layout
 * box between `<section.hero>` and its descendants — `.hero-stack`
 * still positions absolute relative to `.hero` (Phase 90 layout).
 * Mouse + focus events still bubble to the wrapper regardless of
 * display value.
 */
export function HeroController({
  children,
  slideCount,
  autoplay = true,
}: {
  children: ReactNode;
  slideCount: number;
  autoplay?: boolean;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync slide DOM (server-rendered by the parent Hero) when `i`
  // changes. Slides are tagged `data-hero-slide={idx}`. We toggle the
  // `.on` class (CSS handles the cross-fade), update `aria-hidden`,
  // and set `inert` on inactive slides so their CTAs are out of focus
  // order while their HTML stays in the DOM for fade transitions.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const slides = wrapper.querySelectorAll<HTMLElement>('[data-hero-slide]');
    slides.forEach((el, idx) => {
      el.classList.toggle('on', idx === i);
      if (idx === i) {
        el.removeAttribute('aria-hidden');
        el.removeAttribute('inert');
      } else {
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('inert', '');
      }
    });
  }, [i]);

  // Autoplay timer.
  useEffect(() => {
    if (!autoplay || paused) return;
    const t = setTimeout(() => setI((v) => (v + 1) % slideCount), SLIDE_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [i, autoplay, paused, slideCount]);

  return (
    <div
      ref={wrapperRef}
      // display: contents so this wrapper has no layout box of its
      // own — `<section.hero>` (positioned ancestor) and `.hero-stack`
      // (absolutely positioned) keep their existing relationship.
      style={{ display: 'contents' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Pause-on-focus: when a CTA inside the active slide takes
      // focus, freeze autoplay so the slide doesn't swap out from
      // under a keyboard user mid-tab. The currentTarget.contains
      // check makes blur fire only when focus exits the carousel
      // subtree (intra-carousel tabs don't flicker pause on/off).
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {children}

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
            // not wrapping to last. Modulo eliminates any subtle
            // branch asymmetry.
            const total = slideCount;
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
          {Array.from({ length: slideCount }, (_, idx) => (
            <button
              key={idx}
              type="button"
              className={`hero-dot ${idx === i ? 'on' : ''}`}
              onClick={() => setI(idx)}
              aria-label={`Slide ${idx + 1} of ${slideCount}`}
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
          <span className="mono hero-counter">
            {String(i + 1).padStart(2, '0')} / {String(slideCount).padStart(2, '0')}
          </span>
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
    </div>
  );
}
