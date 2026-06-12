/**
 * Admin-dashboard section catalog. Single source of truth for the
 * sidebar nav (app/admin/_components/sidebar.tsx) AND the per-section
 * page-metadata helpers (each section's page.tsx imports the matching
 * entry for its `<title>` + breadcrumb).
 *
 * Adding a section:
 *   1. Add an entry below.
 *   2. Create app/admin/<slug>/page.tsx that imports DASHBOARD_SECTIONS
 *      to look up its label/description, then fetches its widgets.
 *   3. Done — the sidebar auto-renders the new link.
 */

export type DashboardSection = {
  /** Route path (e.g. '/admin/funnel'). */
  href: string;
  /** Slug used in route file paths + as the section key. */
  slug: string;
  /** Short label rendered in the sidebar + browser tab title. */
  label: string;
  /** One-line description rendered in the section header. */
  description: string;
  /**
   * Icon glyph rendered in the sidebar. Plain unicode + emoji-free so
   * it works without an icon font; merchant can swap to lucide-style
   * SVGs in a later pass.
   */
  glyph: string;
};

/**
 * Each entry's `href` is either a real route (`/admin/<slug>` — PR 3+
 * adds these as proper sub-routes that fetch only their widgets) OR
 * an anchor link into the long-scroll `/admin#section-X` (the
 * temporary form used in this PR while the section split is still
 * in-flight). The sidebar component renders them identically; the
 * only difference is navigation behavior.
 */
export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    href: '/admin',
    slug: 'overview',
    label: 'Overview',
    description: 'Today’s headline numbers, recent orders, and anything anomalous.',
    glyph: '▦',
  },
  {
    href: '/admin#section-revenue',
    slug: 'revenue',
    label: 'Revenue',
    description: 'Orders by weekday and hour, refunds, classifications.',
    glyph: '$',
  },
  {
    href: '/admin#section-customers',
    slug: 'customers',
    label: 'Customers',
    description: 'New vs. repeat, lifetime value, repeat-buyer gap.',
    glyph: '◐',
  },
  {
    href: '/admin#section-funnel',
    slug: 'funnel',
    label: 'Funnel',
    description: 'Conversion funnel, cart abandonment, quiz performance.',
    glyph: '⇲',
  },
  {
    href: '/admin#section-chat',
    slug: 'chat',
    label: 'Chat assistant',
    description: 'AI assistant usage, tool calls, reliability, chat-to-order conversion.',
    glyph: '✦',
  },
  {
    href: '/admin#section-acquisition',
    slug: 'acquisition',
    label: 'Acquisition',
    description: 'Traffic sources, revenue by source, device split.',
    glyph: '→',
  },
  {
    href: '/admin#section-catalog',
    slug: 'catalog',
    label: 'Catalog & search',
    description: 'Top products, low stock, SEO gaps, top queries.',
    glyph: '⬢',
  },
  {
    href: '/admin#section-health',
    slug: 'system',
    label: 'System',
    description: 'Core Web Vitals, error rates, infrastructure health.',
    glyph: '◇',
  },
];

export function findSection(slug: string): DashboardSection | undefined {
  return DASHBOARD_SECTIONS.find((s) => s.slug === slug);
}
