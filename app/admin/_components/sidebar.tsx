'use client';

import Link from 'next/link';
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
 *
 * The collapsed/expanded toggle is intentionally NOT persisted — the
 * sidebar is always full-width on desktop and collapses to a hidden
 * drawer on mobile (handled by CSS, not state) so we avoid hydration
 * mismatches and storage reads on cold start.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();

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
            const isActive =
              section.href === '/admin'
                ? pathname === '/admin'
                : pathname === section.href || pathname.startsWith(`${section.href}/`);
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
