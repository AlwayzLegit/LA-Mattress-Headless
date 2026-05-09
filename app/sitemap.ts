import type { MetadataRoute } from 'next';
import { blogs, nonEmptyCollections, products, publishedPages } from '@/lib/inventory';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mattressstoreslosangeles.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (path: string) => `${SITE}${path}`;

  // Custom routes (Next.js, not Shopify-handle-driven) that are
  // publicly indexable. Other custom routes — /cart, /wishlist,
  // /compare, /account, /search — are noindex via metadata.robots
  // and intentionally absent here.
  const home: MetadataRoute.Sitemap = [
    { url: u('/'),                            lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: u('/sleep-quiz'),                  lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: u('/pages/reviews'),               lastModified: now, changeFrequency: 'weekly',  priority: 0.55 },
    { url: u('/pages/data-sharing-opt-out'),  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
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

  const pageEntries: MetadataRoute.Sitemap = publishedPages.map((p) => ({
    url: u(`/pages/${p.handle}`),
    lastModified: new Date(p.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const blogEntries: MetadataRoute.Sitemap = blogs.map((b) => ({
    url: u(`/blogs/${b.handle}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const articleEntries: MetadataRoute.Sitemap = blogs.flatMap((b) =>
    (b.articles ?? []).map((a) => ({
      url: u(`/blogs/${b.handle}/${a.handle}`),
      lastModified: a.publishedAt ? new Date(a.publishedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.55,
    })),
  );

  return [...home, ...productEntries, ...collectionEntries, ...pageEntries, ...blogEntries, ...articleEntries];
}
