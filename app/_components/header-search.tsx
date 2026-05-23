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
      // e.key is typed as `string` but can be undefined in the wild —
      // IME composition events on Android Chrome dispatch a synthetic
      // keydown with no `key`, and some mobile keyboards strip it on
      // numeric-input fields (Sentry LA-MATTRESS-HEADLESS-10: a user
      // typing in the PLP price-filter triggered exactly this on
      // Chrome Mobile 148 / Android 10). Optional-chain so the rest
      // of the handler can short-circuit instead of throwing.
      const key = e.key?.toLowerCase();
      if (!key) return;
      const isCmdK =
        key === 'k' &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey;

      if (isCmdK) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable);
      if (editable) return;
      e.preventDefault();
      setOpen(true);
    };
    // Phase 186: window + capture phase so the handler fires before
    // any third-party instrumentation (Sentry breadcrumbs, Vercel
    // feedback widget) that wraps document-level listeners. The
    // pre-split version used document/bubble and the Cowork verifier
    // of PR #51 confirmed shortcuts didn't reach it post-rebuild —
    // moving up the propagation tree keeps the listener authoritative.
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
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
