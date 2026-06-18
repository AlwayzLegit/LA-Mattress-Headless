/**
 * Curated LA-local buying guides surfaced on the neighborhood pages
 * (SEO plan Phase 5 — internal-linking & orphan cleanup).
 *
 * Why this exists: the SEMrush 20260616 audit flagged these local
 * "best mattress for X in Los Angeles" articles under issue 213 (pages
 * with only one internal link). They're orphaned because the
 * related-articles rotation reads data/url-inventory/blogs.json, which is
 * frozen at 2026-05-25 (the nightly refresh has failed since the
 * SHOPIFY_ADMIN_TOKEN expired) — every article created after that date is
 * invisible to the rotation. This is a token-independent fix: the 27
 * neighborhood pages are the most topically-appropriate inbound-link
 * source (local intent, local content), so a curated "Local guides" block
 * gives each guide ~27 relevant inbound links without touching Shopify.
 *
 * Paths confirmed live in the SEMrush June-16 crawl. Keep this list
 * short and canonical — if a guide URL is ever consolidated, update the
 * one line here (the storefront redirect layer 301s any stale link in the
 * meantime, so a lagging entry degrades gracefully rather than 404ing).
 */
export type LocalGuide = {
  /** Live storefront path (article URL). */
  href: string;
  /** Link text / card title. */
  title: string;
  /** One-line description shown under the title. */
  blurb: string;
};

export const LOCAL_GUIDES: LocalGuide[] = [
  {
    href: '/blogs/mattress-buying-guide/best-mattress-for-back-pain-in-los-angeles-a-local-buyers-guide',
    title: 'Best mattress for back pain in LA',
    blurb: 'A local buyer’s guide to the support and firmness that ease back pain — and where to try them.',
  },
  {
    href: '/blogs/mattress-buying-guide/best-mattress-for-lower-back-pain-los-angeles',
    title: 'Best mattress for lower back pain',
    blurb: 'How to pick a mattress that relieves lower-back pressure, with LA showroom picks to test in person.',
  },
  {
    href: '/blogs/sleep-blog/best-cooling-mattress-for-hot-sleepers-in-los-angeles-2026-guide',
    title: 'Best cooling mattress for hot sleepers',
    blurb: 'Cooling builds that handle warm LA nights — gel foams and breathable hybrids compared.',
  },
];
