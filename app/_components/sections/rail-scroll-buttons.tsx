'use client';

import { Icon } from '../icon';

/**
 * Tiny client island for any horizontal-scroll rail's prev/next buttons.
 * Locates the rail via document.getElementById so the rail itself can stay
 * server-rendered. ~0.5KB hydration vs the 2KB+ a parent client component
 * would have shipped.
 *
 * Used by:
 *   - PopularProducts (homepage)        Phase 163
 *   - Showrooms (homepage, dark variant) Phase 164
 */
type Props = {
  railId: string;
  leftLabel: string;
  rightLabel: string;
  /** px to scroll per click. Defaults to 600 (matches the previous useRef behavior). */
  step?: number;
  /** "dark" applies .round-btn-dark for sections with a dark background. */
  variant?: 'default' | 'dark';
};

export function RailScrollButtons({ railId, leftLabel, rightLabel, step = 600, variant = 'default' }: Props) {
  const scroll = (dir: -1 | 1) => {
    const el = document.getElementById(railId);
    // JS scrollBy ignores the CSS reduced-motion kill switch, so gate
    // the smooth behavior on the media query directly (audit
    // a11y-motion-04) — same pattern as hero-controller.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollBy({ left: dir * step, behavior: reduced ? 'auto' : 'smooth' });
  };
  const btnClass = variant === 'dark' ? 'round-btn round-btn-dark' : 'round-btn';
  const wrapClass = variant === 'dark' ? 'scroll-controls scroll-controls-dark' : 'scroll-controls';
  return (
    <div className={wrapClass}>
      <button className={btnClass} type="button" onClick={() => scroll(-1)} aria-label={leftLabel}>
        <Icon name="arrow-left" size={16} />
      </button>
      <button className={btnClass} type="button" onClick={() => scroll(1)} aria-label={rightLabel}>
        <Icon name="arrow-right" size={16} />
      </button>
    </div>
  );
}
