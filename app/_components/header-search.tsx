'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Icon } from './icon';

/**
 * Header search — trigger + lazy-loaded overlay.
 *
 * Phase 183 split: the overlay is ~430 LOC of predictive-search /
 * focus-trap / scroll-lock / portal code that's only useful once the
 * user actually opens the panel. Code-splitting it via `next/dynamic`
 * with `ssr: false` keeps the trigger button + keyboard shortcuts in
 * the always-shipped nav bundle, and defers the rest until first
 * interaction.
 *
 * Keyboard shortcuts stay on the trigger:
 *   "/"      — GitHub-style. Ignored when typing in an input/textarea
 *              so it doesn't hijack regular typing.
 *   Cmd+K    — Mac (also Ctrl+K on Windows/Linux). Command-palette
 *              pattern from the design's search overlay; works even
 *              when an input is focused.
 *
 * Both shortcuts call `setOpen(true)`, which triggers the dynamic
 * import. Subsequent opens reuse the cached chunk.
 */
const HeaderSearchOverlay = dynamic(
  () => import('./header-search-overlay').then((m) => m.HeaderSearchOverlay),
  { ssr: false },
);

export function HeaderSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK =
        e.key.toLowerCase() === 'k' &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey;

      if (isCmdK) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable);
      if (editable) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Search (press / to focus)"
        title="Search ( / )"
        onClick={() => setOpen(true)}
      >
        <Icon name="search" size={18} />
      </button>

      {open ? <HeaderSearchOverlay onClose={() => setOpen(false)} /> : null}
    </>
  );
}
