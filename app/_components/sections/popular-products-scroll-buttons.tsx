'use client';

import { Icon } from '../icon';

/**
 * Tiny client island for the popular-products rail's prev/next buttons.
 * The rail itself is server-rendered; locating it via document.getElementById
 * lets the rail stay outside the client bundle. About 0.5KB of hydration
 * vs the ~2KB the parent section had previously.
 */
export function PopularProductsScrollButtons({ railId }: { railId: string }) {
  const scroll = (dir: -1 | 1) => {
    const el = document.getElementById(railId);
    el?.scrollBy({ left: dir * 600, behavior: 'smooth' });
  };
  return (
    <div className="scroll-controls">
      <button className="round-btn" type="button" onClick={() => scroll(-1)} aria-label="Scroll popular mattresses left">
        <Icon name="arrow-left" size={16} />
      </button>
      <button className="round-btn" type="button" onClick={() => scroll(1)} aria-label="Scroll popular mattresses right">
        <Icon name="arrow-right" size={16} />
      </button>
    </div>
  );
}
