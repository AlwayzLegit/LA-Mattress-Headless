'use client';

import { useEffect, useState } from 'react';

/**
 * Sticky table of contents for ServicePage. Scans the rendered CMS
 * body for h2 elements after mount, slugs them, assigns ids, and
 * renders an anchor list in a sticky right-rail column on desktop.
 *
 * Why client-only: the body HTML comes from merchant CMS content
 * (dangerouslySetInnerHTML), so we can't traverse it during SSR
 * without re-parsing the body server-side. Reading the DOM after
 * hydration is simpler and lets the TOC stay in sync if the CMS
 * body changes shape without a redeploy.
 *
 * Hides itself when the body has fewer than 3 h2s — for short pages
 * the TOC is more noise than navigation. Hidden on tablet/mobile
 * via CSS (the right rail collapses below the body, where a TOC
 * adds no value).
 */
export function ServicePageToc({ bodyContainerId }: { bodyContainerId: string }) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const container = document.getElementById(bodyContainerId);
    if (!container) return;
    const h2s = Array.from(container.querySelectorAll('h2'));
    if (h2s.length < 3) return;
    const collected: { id: string; text: string }[] = [];
    const seen = new Set<string>();
    for (const h2 of h2s) {
      const text = (h2.textContent || '').trim();
      if (!text) continue;
      let slug = slugify(text);
      // Deduplicate slug suffixes — two h2 with the same text would
      // otherwise both anchor to the same id and only the first link
      // would scroll correctly.
      let i = 2;
      while (seen.has(slug)) {
        slug = `${slugify(text)}-${i}`;
        i += 1;
      }
      seen.add(slug);
      if (!h2.id) h2.id = slug;
      // scroll-margin-top so the anchor scroll doesn't land the h2
      // underneath the sticky topbar / nav.
      h2.style.scrollMarginTop = '100px';
      collected.push({ id: h2.id, text });
    }
    setItems(collected);
  }, [bodyContainerId]);

  if (items.length === 0) return null;

  return (
    <aside className="service-page-toc" aria-label="On this page">
      <p className="service-page-toc-label">On this page</p>
      <ol className="service-page-toc-list">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`}>{it.text}</a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
