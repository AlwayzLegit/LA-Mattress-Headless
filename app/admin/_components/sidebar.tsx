'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { DASHBOARD_SECTIONS } from '@/lib/dashboard/sections';

/**
 * Persistent left-rail navigation across every /admin route.
 *
 * Client component because:
 *   - usePathname needs to highlight the active link.
 *   - useSearchParams round-trips the current date-range / compare
 *     state across sections so a merchant flipping between Revenue
 *     and Customers doesn't lose their window.
 *   - The scroll spy (below) needs IntersectionObserver.
 *
 * The collapsed/expanded toggle is intentionally NOT persisted — the
 * sidebar is always full-width on desktop and collapses to a hidden
 * drawer on mobile (handled by CSS, not state) so we avoid hydration
 * mismatches and storage reads on cold start.
 */

/**
 * Scroll spy for the long-scroll /admin page. Most section entries are
 * `#section-X` anchors into one page, so pathname-based highlighting
 * could only ever mark "Overview" — the rail went dead the moment the
 * merchant scrolled. This hook watches the section bands and returns
 * the id of the one currently under the reading line (a stripe in the
 * upper third of the viewport, below the sticky toolbar), or null when
 * the scroll position is above the first band (= Overview).
 */
function useSectionSpy(enabled: boolean): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setActiveId(null);
      return;
    }
    const ids = DASHBOARD_SECTIONS
      .map((s) => s.href.split('#')[1])
      .filter((id): id is string => Boolean(id));
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    // Intersection state per section, recomputed on every transition;
    // the FIRST intersecting section in document order wins. (Acting
    // only on the transitioning entry would let a tall section's exit
    // event steal the highlight from an earlier section still in the
    // stripe.)
    const inView = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          inView.set(entry.target.id, entry.isIntersecting);
        }
        const current = ids.find((id) => inView.get(id));
        setActiveId(current ?? null);
      },
      // Top inset clears the sticky toolbar; the -60% bottom inset
      // narrows the hit area to the upper third so the highlight flips
      // when a section header reaches reading position, not when its
      // tail is still filling the screen.
      { rootMargin: '-90px 0px -60% 0px' },
    );
    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return activeId;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const spiedId = useSectionSpy(pathname === '/admin');

  // Carry the active range/compare params across section links so
  // navigation feels stateful even though each route fetches its own
  // data. Drop refreshed=1 — it's a one-shot post-redirect marker.
  const carry = new URLSearchParams();
  for (const k of ['range', 'from', 'to', 'compare']) {
    const v = sp.get(k);
    if (v) carry.set(k, v);
  }
  const carryQs = carry.toString();

  return (
    <aside className="dash-sidebar" aria-label="Dashboard sections">
      <div className="dash-sidebar-brand">
        <span className="dash-sidebar-mark">LA</span>
        <span className="dash-sidebar-brand-text">
          Mattress
          <span className="muted" style={{ fontSize: 11, display: 'block', fontWeight: 400 }}>
            Internal dashboard
          </span>
        </span>
      </div>
      <nav>
        <ul className="dash-sidebar-list">
          {DASHBOARD_SECTIONS.map((section) => {
            const anchorId = section.href.split('#')[1] ?? null;
            const isActive =
              pathname === '/admin'
                ? // On the long-scroll page the spy decides; Overview
                  // holds the highlight while above the first band.
                  (anchorId ? spiedId === anchorId : spiedId === null)
                : // Off the long-scroll page (e.g. /admin/orders/[id]),
                  // exact-or-prefix match — but never prefix-match the
                  // '/admin' root entry, or Overview would light up on
                  // every sub-route.
                  section.href !== '/admin' &&
                  (pathname === section.href || pathname.startsWith(`${section.href}/`));
            const href = carryQs ? `${section.href}?${carryQs}` : section.href;
            return (
              <li key={section.href}>
                <Link
                  href={href}
                  className={`dash-sidebar-link${isActive ? ' dash-sidebar-link-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  prefetch={false}
                >
                  <span aria-hidden="true" className="dash-sidebar-glyph">
                    {section.glyph}
                  </span>
                  <span>{section.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
