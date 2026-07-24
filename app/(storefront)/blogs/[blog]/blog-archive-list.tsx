'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Icon } from '@/app/_components/icon';

/**
 * BlogArchiveList — the complete A–Z article archive, kept for its SEO
 * job (every article gets a depth-3 crawl path) but no longer dumped as
 * a wall of hundreds of links.
 *
 * Every link is always rendered into the DOM, so crawlers still reach
 * the full archive and the depth-3 guarantee holds. The overflow beyond
 * `initialVisible` is just visually hidden (the `hidden` attribute keeps
 * the nodes in the document) until the reader expands it. On a blog like
 * mattress-buying-guide (600+ articles) that turns an unreadable slab
 * into a tidy "Show all N articles" disclosure.
 */
export function BlogArchiveList({
  blogHandle,
  items,
  initialVisible = 24,
}: {
  blogHandle: string;
  items: { handle: string; title: string }[];
  initialVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = items.length > initialVisible;

  return (
    <>
      <ul className="html-sitemap-list" style={{ marginTop: 'var(--s-5)' }}>
        {items.map((a, i) => (
          <li key={a.handle} hidden={!expanded && hasOverflow && i >= initialVisible}>
            <Link href={`/blogs/${blogHandle}/${a.handle}`}>{a.title}</Link>
          </li>
        ))}
      </ul>
      {hasOverflow ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 'var(--s-4)' }}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Show fewer <Icon name="chevron-down" size={14} style={{ transform: 'rotate(180deg)' }} />
            </>
          ) : (
            <>
              Show all {items.length} articles <Icon name="chevron-down" size={14} />
            </>
          )}
        </button>
      ) : null}
    </>
  );
}
