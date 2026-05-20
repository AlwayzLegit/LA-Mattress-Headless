/**
 * Build-time accessors for the committed URL inventory snapshot.
 *
 * Used by:
 *   - generateStaticParams() on dynamic routes
 *   - sitemap.xml generation
 *   - dev-time link validation
 *
 * Snapshot is refreshed via `node scripts/pull-inventory.mjs`.
 */

import collectionsJson from '@/data/url-inventory/collections.json';
import productsJson    from '@/data/url-inventory/products.json';
import pagesJson       from '@/data/url-inventory/pages.json';
import blogsJson       from '@/data/url-inventory/blogs.json';

export type CollectionInv = {
  handle: string;
  id: string;
  title: string;
  productsCount: number;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ProductInv = {
  handle: string;
  vendor: string;
  productType: string;
  publishedAt: string;
  updatedAt: string;
};

export type PageInv = {
  handle: string;
  title: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

export type BlogArticleInv = {
  handle: string;
  id?: string;
  title?: string;
  isPublished?: boolean;
  publishedAt?: string | null;
  /**
   * Bumps whenever the article body / SEO / tags are edited in Shopify
   * (independent of publishedAt). Sitemap lastmod prefers this over
   * publishedAt so edits to live articles get re-crawled promptly.
   * Optional for snapshot backward-compat — older snapshots (pre Phase
   * 297b) don't carry this field, callers fall back to publishedAt.
   */
  updatedAt?: string | null;
};

export type BlogInv = {
  handle: string;
  id: string;
  title: string;
  // Populated by scripts/pull-articles-via-storefront.mjs (or
  // scripts/pull-inventory.mjs with read_content scope on Admin).
  articles?: BlogArticleInv[];
};

/** Convenience: just article handles, used by sitemap + generateStaticParams. */
export function articleHandles(blog: BlogInv): string[] {
  return (blog.articles ?? []).map((a) => a.handle);
}

export const collections: CollectionInv[] = collectionsJson.collections as CollectionInv[];
export const products:    ProductInv[]    = productsJson.products as ProductInv[];
export const pages:       PageInv[]       = pagesJson.pages as PageInv[];
export const blogs:       BlogInv[]       = blogsJson.blogs as BlogInv[];

/** Pages with `isPublished: true` are the only ones with live `/pages/{handle}` URLs. */
export const publishedPages: PageInv[] = pages.filter((p) => p.isPublished);

/** Collections with at least one published product. The empty ones still resolve in Shopify but are weak SEO surfaces. */
export const nonEmptyCollections: CollectionInv[] = collections.filter((c) => c.productsCount > 0);

export function findProduct(handle: string): ProductInv | undefined {
  return products.find((p) => p.handle === handle);
}
export function findCollection(handle: string): CollectionInv | undefined {
  return collections.find((c) => c.handle === handle);
}
export function findPage(handle: string): PageInv | undefined {
  return pages.find((p) => p.handle === handle);
}
export function findBlog(handle: string): BlogInv | undefined {
  return blogs.find((b) => b.handle === handle);
}
