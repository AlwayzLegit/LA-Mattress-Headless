import type { MetadataRoute } from 'next';
import { blogs, nonEmptyCollections, products, publishedPages } from '@/lib/inventory';
import { SHOWROOMS } from '@/lib/showrooms';
import { NEIGHBORHOODS } from '@/lib/neighborhoods';
import { SITE_URL } from '@/lib/site-config';
import { isNoindexArticle } from '@/lib/noindex-articles';
import { CODED_PAGE_HANDLES, isCodedPage } from '@/lib/coded-pages';
import redirectsJson from '@/data/url-inventory/redirects.json';

// Legacy handles that 301 (same redirects.json that feeds
// next.config + lib/sanitize). url-inventory still lists many of these
// (old article/blog/page/collection handles), so without this filter
// the sitemap advertises 32 URLs that permanently redirect — SEMrush
// 20260518 "Incorrect pages found in sitemap.xml". A sitemap must only
// list canonical 200 URLs. Path-keyed, trailing-slash-normalized.
const REDIRECT_SOURCES: ReadonlySet<string> = new Set(
  ((redirectsJson as { redirects?: { source?: string }[] }).redirects ?? [])
    .map((r) => (typeof r?.source === 'string' ? r.source.replace(/\/+$/, '') || '/' : ''))
    .filter(Boolean),
);

// Canonical host — never the apex. See lib/site-config.ts#canonicalizeSiteUrl:
// emitting apex URLs here makes every crawler hit a 308 hop.
const SITE = SITE_URL;

/**
 * Phase 277e: showroom + neighborhood pages are high-intent local
 * landing pages — they should signal more importance to crawlers than
 * a generic CMS page (warranty / financing / returns). Bumped from
 * the default 0.7 to 0.85, matching collections.
 *
 * Locations index gets the same treatment for the same reason.
 */
const LOCAL_LANDING_HANDLES = new Set<string>([
  ...SHOWROOMS.map((s) => s.handle),
  ...NEIGHBORHOODS.map((n) => n.handle),
  'mattress-store-locations',
]);

/**
 * Phase 260: blog handles that exist in the inventory snapshot but are
 * deprecated — every URL under them now 301/308-redirects, so listing
 * them in the sitemap signals stale content to crawlers and triggers
 * SEMrush's "Incorrect pages found in sitemap.xml" flag.
 *
 * `beds-mattresses` is the old Hydrogen-era blog. Phase 251 added a
 * wildcard redirect (`/blogs/beds-mattresses/:slug* → /blogs/sleep-blog`)
 * for its 184 articles; this phase removes the blog from the sitemap
 * entirely and adds a redirect for the bare blog index (no slug —
 * not caught by the wildcard).
 *
 * When the inventory is regenerated from Shopify, the dead blog will
 * likely re-appear (Shopify still exposes it). Keeping the filter here
 * is durable across regenerations.
 */
const DEPRECATED_BLOG_HANDLES = new Set(['beds-mattresses']);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (path: string) => `${SITE}${path}`;

  // Custom routes (Next.js, not Shopify-handle-driven) that are
  // publicly indexable. Other custom routes — /cart, /wishlist,
  // /compare, /account, /search — are noindex via metadata.robots
  // and intentionally absent here.
  // /pages/reviews + /pages/data-sharing-opt-out are NOT listed here —
  // they're coded pages, emitted once via codedPageEntries below.
  const home: MetadataRoute.Sitemap = [
    { url: u('/'),                            lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: u('/blogs'),                       lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: u('/sleep-quiz'),                  lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: u(`/products/${p.handle}`),
    lastModified: new Date(p.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  // nonEmptyCollections drops handles with productsCount === 0. Empty
  // collection URLs still resolve in Shopify but they're weak SEO
  // surfaces — keeping them out of the sitemap avoids signaling
  // thin/empty pages to crawlers.
  const collectionEntries: MetadataRoute.Sitemap = nonEmptyCollections.map((c) => ({
    url: u(`/collections/${c.handle}`),
    lastModified: new Date(c.updatedAt),
    changeFrequency: 'daily',
    priority: 0.85,
  }));

  // Exclude coded handles: `reviews` / `data-sharing-opt-out` are
  // isPublished CMS pages but are served by the coded mechanism, so
  // they're emitted once via codedPageEntries (never double-listed).
  const pageEntries: MetadataRoute.Sitemap = publishedPages
    .filter((p) => !isCodedPage(p.handle))
    .map((p) => {
      const isLocalLanding = LOCAL_LANDING_HANDLES.has(p.handle);
      return {
        url: u(`/pages/${p.handle}`),
        lastModified: new Date(p.updatedAt),
        changeFrequency: isLocalLanding ? ('weekly' as const) : ('monthly' as const),
        priority: isLocalLanding ? 0.85 : 0.7,
      };
    });

  // Coded /pages/* — hand-built routes dispatched via app/pages/[handle]
  // (faq, low-price-guarantee have no CMS record; reviews,
  // data-sharing-opt-out bypass their CMS body). Per-handle crawl hints
  // preserve the signals these URLs carried before consolidation.
  const CODED_SITEMAP_HINTS: Record<
    string,
    { changeFrequency: 'weekly' | 'monthly' | 'yearly'; priority: number }
  > = {
    reviews: { changeFrequency: 'weekly', priority: 0.55 },
    'data-sharing-opt-out': { changeFrequency: 'yearly', priority: 0.3 },
  };
  const codedPageEntries: MetadataRoute.Sitemap = CODED_PAGE_HANDLES.map((h) => {
    const hint = CODED_SITEMAP_HINTS[h] ?? { changeFrequency: 'monthly' as const, priority: 0.6 };
    return {
      url: u(`/pages/${h}`),
      lastModified: now,
      changeFrequency: hint.changeFrequency,
      priority: hint.priority,
    };
  });

  const liveBlogs = blogs.filter((b) => !DEPRECATED_BLOG_HANDLES.has(b.handle));

  const blogEntries: MetadataRoute.Sitemap = liveBlogs.map((b) => ({
    url: u(`/blogs/${b.handle}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const articleEntries: MetadataRoute.Sitemap = liveBlogs.flatMap((b) =>
    (b.articles ?? [])
      // Keep noindexed doorway-style posts out of the sitemap so we
      // don't ask Google to crawl pages we've told it not to index.
      .filter((a) => !isNoindexArticle(b.handle, a.handle))
      .map((a) => ({
        url: u(`/blogs/${b.handle}/${a.handle}`),
        lastModified: a.publishedAt ? new Date(a.publishedAt) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.55,
      })),
  );

  const all = [
    ...home,
    ...productEntries,
    ...collectionEntries,
    ...pageEntries,
    ...codedPageEntries,
    ...blogEntries,
    ...articleEntries,
  ];
  // Final guard: never emit a URL that 301-redirects, regardless of
  // which builder produced it or how url-inventory regenerates.
  return all.filter((e) => {
    const path = e.url.slice(SITE.length).replace(/\/+$/, '') || '/';
    return !REDIRECT_SOURCES.has(path);
  });
}
