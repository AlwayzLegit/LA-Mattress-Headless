import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mattressstoreslosangeles.com';

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
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
