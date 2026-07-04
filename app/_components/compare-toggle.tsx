'use client';

import { Icon } from './icon';
import { announce } from './announcer';
import {
  COMPARE_MAX,
  readCompareSet,
  useCompareSet,
  writeCompareSet,
} from './compare-store';

/**
 * Adds/removes a product from the compare set. Lives inside a PLP card —
 * the click handler stops propagation so it doesn't trigger the parent
 * <Link>'s navigation.
 *
 * Cap is COMPARE_MAX (4 items) — beyond that we silently no-op the add
 * (with an SR announcement explaining why). Keeps the compare table
 * from getting unwieldy.
 *
 * Phase 197: split out of `compare.tsx` into its own file so the
 * tray's tree (`CompareTray`, `usePathname`, IntersectionObserver
 * setup, footer-watching effect, dismiss state, `next/link`) doesn't
 * ship in PLP / search route chunks. Pre-split, both components
 * lived in `compare.tsx` so any importer of either dragged in both.
 */
export function CompareToggle({ handle, title }: { handle: string; title: string }) {
  // Phase 212: store sync via shared hook. `selected` is derived from
  // the live `items` instead of being mirrored into local state.
  const { items, hydrated } = useCompareSet();
  const selected = items.some((p) => p.handle === handle);

  const onToggle = (e: React.MouseEvent | React.ChangeEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = readCompareSet();
    const idx = cur.findIndex((p) => p.handle === handle);
    if (idx >= 0) {
      cur.splice(idx, 1);
      writeCompareSet(cur);
      announce(`Removed ${title} from compare`);
    } else if (cur.length < COMPARE_MAX) {
      cur.push({ handle, title });
      writeCompareSet(cur);
      announce(`Added ${title} to compare. ${cur.length} of ${COMPARE_MAX} selected.`);
    } else {
      // Already 4 selected — surface it audibly so SR users know why
      // their click did nothing.
      announce(`Compare is full. Remove one of the ${COMPARE_MAX} selected mattresses first.`);
    }
  };

  // SSR in the unselected default state instead of returning null
  // (audit ux-plp-06: the null-until-hydrated version popped a ~40px
  // button into every one of 24 PLP cards at hydration, reflowing the
  // whole grid under the shopper's thumb — feeding the PLP CLS tail).
  // The markup below is identical server- and client-side for the
  // default state, so there's no hydration mismatch; a card that IS in
  // the compare set just flips aria-pressed/check after hydration — a
  // paint-only change, no layout shift. Clicks before hydration are
  // ignored via the `hydrated` guard (same net behavior as before,
  // where the button didn't exist yet).
  const shown = hydrated && selected;

  return (
    <button
      type="button"
      className={`compare-toggle${shown ? ' is-selected' : ''}`}
      onClick={(e) => {
        if (!hydrated) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onToggle(e);
      }}
      aria-pressed={shown}
      aria-label={shown ? `Remove ${title} from compare` : `Add ${title} to compare (up to ${COMPARE_MAX})`}
    >
      <span className="compare-toggle-box" aria-hidden>
        {shown ? <Icon name="check" size={12} /> : null}
      </span>
      Compare
    </button>
  );
}
