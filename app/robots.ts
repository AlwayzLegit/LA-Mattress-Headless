import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mattressstoreslosangeles.com';

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
 * Phase 273: also disallow query-string permutations Google indexes as
 * separate URLs even though our canonical points to the bare URL. These
 * patterns inflate our indexed-pages count without ranking value:
 *
 *   /*?variant=*  — PDP variant selector. Pure UI state; canonical
 *                   already drops the variant param. 195 products ×
 *                   ~5 variants each = ~975 redundant URLs.
 *   /*?srsltid=*  — Google Search click-through tracking. Google itself
 *                   indexes these as distinct URLs, then later dedupes.
 *                   Faster to disallow upfront.
 *   /*?_pos=*, /*?_sid=*, /*?_ss=*  — Shopify search pagination/sort
 *                   tracking params. Same UI-state pattern.
 *   /*?after=*    — pagination cursor. Filtered content; canonical drops it.
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
          '/*?variant=*',
          '/*?srsltid=*',
          '/*?_pos=*',
          '/*?_sid=*',
          '/*?_ss=*',
          '/*?after=*',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
