import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';

// Canonical host — never the apex. The Sitemap: directive matters: Google
// fetches sitemap.xml from the URL declared here, so an apex value forces
// a 308 hop on first sitemap discovery. See lib/site-config.ts.
const SITE = SITE_URL;

/**
 * robots.txt rules. Keep aligned with the per-route `metadata.robots`
 * settings in the matching page files — both layers exist so crawlers
 * that don't fully respect meta-robots (some image / scrape bots) still
 * skip the surfaces that have no SEO value or render localStorage-only
 * content.
 *
 * Disallowed surfaces:
 *   /cart, /checkout    — transactional, indexing them would surface
 *                         stale state to search results
 *   /account            — Shopify-hosted account redirect placeholder
 *   /wishlist           — localStorage-only; crawlers see an empty card
 *                         grid that doesn't represent real content
 *   /compare            — same; tray + ?ids= driven; no canonical content
 *   /search?            — query-string driven; the no-q recovery grid is
 *                         all the indexable content here
 *   /api/               — JSON endpoints + webhook receivers
 *
 * Phase 275: query-param disallows scoped to TRACKING-only params per
 * Google's official guidance
 * (developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls):
 * "Don't use robots.txt disallow to handle duplicates — use canonical
 * tags." Content-distinguishing params (`?variant=` on PDPs,
 * `?after=` pagination) are now handled via canonical alone so Google
 * can crawl them, read the canonical, and consolidate signals properly.
 * The patterns below are crawl-budget-only tracking params with no
 * unique content:
 *
 *   /*?srsltid=*  — Google Search click-through tracking (Google's own
 *                   tracking redirect; safe to block).
 *   /*?_pos=*, /*?_sid=*, /*?_ss=*  — Shopify search-source/session
 *                   tracking params. No content value.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/cart',
          '/checkout',
          '/account',
          '/wishlist',
          '/compare',
          '/search?',
          '/api/',
          // Internal admin surfaces — also gated by HTTP Basic Auth at
          // the edge (see middleware.ts) and X-Robots-Tag noindex on
          // every response. Defense-in-depth: this stops well-behaved
          // crawlers from even attempting to fetch them.
          '/admin/',
          '/*?srsltid=*',
          '/*?_pos=*',
          '/*?_sid=*',
          '/*?_ss=*',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
