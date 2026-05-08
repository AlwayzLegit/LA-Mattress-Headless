'use client';

import { useEffect, useRef, useState } from 'react';
import type { Heading } from '@/lib/article-toc';

/**
 * Distance from the viewport top that "activates" a heading. A heading
 * is treated as the active section the moment its `top` scrolls above
 * this line — i.e., we're now reading the body underneath it. 120px
 * clears the sticky nav (~64px) plus a little breathing room so the
 * highlight advances just before the heading itself disappears under
 * the nav.
 */
const ACTIVE_OFFSET_PX = 120;

/**
 * Sticky TOC for the article 3-col layout (design §Guide detail).
 *
 * Renders the same SSR markup as the design's GuidePage (eyebrow + ul
 * of borderless anchor links) but tracks which heading the reader is
 * currently in via document position rather than IntersectionObserver
 * bands. The IO band approach was unreliable when headings are spaced
 * far apart — the band would be empty between H2s and the active link
 * never advanced past heading #1.
 *
 * Now: on every scroll (RAF-throttled), measure each heading's top
 * relative to the viewport, and the active heading is the LAST one
 * whose top has scrolled above ACTIVE_OFFSET_PX. That's the section
 * the reader is currently inside.
 */
export function ArticleToc({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? '');
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings
      .map((h) => ({ id: h.id, el: document.getElementById(h.id) }))
      .filter((x): x is { id: string; el: HTMLElement } => x.el !== null);
    if (elements.length === 0) return;

    const compute = () => {
      // The active heading is the last one whose top is at or above
      // the activation line. Iterate top-to-bottom — the moment a
      // heading is still below the line, every subsequent heading is
      // also below, so we can break.
      let next = elements[0].id;
      for (const { id, el } of elements) {
        const top = el.getBoundingClientRect().top;
        if (top <= ACTIVE_OFFSET_PX) {
          next = id;
        } else {
          break;
        }
      }
      setActiveId((prev) => (prev === next ? prev : next));
    };

    const onScroll = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        compute();
      });
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [headings]);

  if (headings.length === 0) return <aside aria-hidden="true" />;

  return (
    <aside className="gd-toc" aria-label="Article contents">
      <div className="gd-toc-eyebrow">Contents</div>
      <ul>
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className={h.id === activeId ? 'on' : undefined}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
