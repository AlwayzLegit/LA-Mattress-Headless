'use client';

import { useEffect, useRef, useState } from 'react';
import type { Heading } from '@/lib/article-toc';

/**
 * Sticky TOC for the article 3-col layout (design §Guide detail).
 *
 * Mirrors the SSR markup the design's GuidePage emits — eyebrow + ul of
 * borderless anchor links — but adds a client-side IntersectionObserver
 * so the `.on` modifier tracks which section the reader is currently in,
 * not just the first one as it does in the static design.
 *
 * The IO uses a top-biased rootMargin so a heading becomes "active"
 * roughly when its top crosses 30% down from the viewport top, which
 * matches reading position better than mid-screen for a long-form post.
 *
 * If no entries are intersecting (e.g. the reader is between two long
 * sections, or scrolled to the very bottom), we hold the last active id
 * rather than blanking the highlight, so the rail never reads "nothing
 * selected" mid-scroll.
 */
export function ArticleToc({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? '');
  const lastActive = useRef<string>(headings[0]?.id ?? '');

  useEffect(() => {
    if (headings.length === 0) return;
    const targets = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        }
        if (visible.size === 0) {
          setActiveId(lastActive.current);
          return;
        }
        // Of currently-visible headings, pick the one earliest in the
        // document order (highest in viewport) — that's what the reader
        // is "in".
        const visibleInOrder = headings
          .map((h) => h.id)
          .filter((id) => visible.has(id));
        const next = visibleInOrder[0] ?? lastActive.current;
        lastActive.current = next;
        setActiveId(next);
      },
      {
        // Top of intersection box sits 96px below the viewport top
        // (clears the sticky nav). Bottom sits 70% up — a heading is
        // active until the next one's top reaches 30% from the top.
        rootMargin: '-96px 0px -70% 0px',
        threshold: [0, 1],
      },
    );

    for (const t of targets) observer.observe(t);
    return () => observer.disconnect();
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
