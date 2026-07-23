import { NextResponse, type NextRequest } from 'next/server';

import { getBlogByHandle } from '@/lib/shopify';
import { displayAuthorName } from '@/lib/article-author';
import type { ArticleCard } from '@/app/(storefront)/blogs/[blog]/blog-article-feed';

/**
 * /api/blog-articles — the data source for the blog index's infinite
 * scroll. Given a blog handle + an opaque Shopify `after` cursor, it
 * returns the next page of article-card data plus the cursor for the
 * following page (or null when the archive is exhausted).
 *
 * The first slice is still server-rendered by blogs/[blog]/page.tsx for
 * LCP + no-JS crawlability; this endpoint only feeds subsequent slices
 * appended client-side, so there is no full-page navigation on "load
 * more" anymore. Serializes exactly the fields the card needs (nothing
 * more), with the author name and date label pre-normalized so the
 * client renders a plain string and can't drift from the SSR markup.
 */

const PER_PAGE = 12;
const SHOPIFY_CONFIGURED = Boolean(
  process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!SHOPIFY_CONFIGURED) {
    return NextResponse.json({ error: 'unconfigured' }, { status: 404 });
  }
  const handle = request.nextUrl.searchParams.get('blog');
  const after = request.nextUrl.searchParams.get('after');
  if (!handle) {
    return NextResponse.json({ error: 'missing blog handle' }, { status: 400 });
  }

  const blog = await getBlogByHandle({ handle, first: PER_PAGE, after }).catch(() => null);
  if (!blog) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const articles: ArticleCard[] = blog.articles.nodes.map((a) => ({
    id: a.id,
    handle: a.handle,
    title: a.title,
    excerpt: a.excerpt ?? null,
    imageUrl: a.image?.url ?? null,
    imageAlt: a.image?.altText ?? a.title,
    publishedAt: a.publishedAt,
    dateLabel: new Date(a.publishedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    authorName: displayAuthorName(a.author),
  }));

  return NextResponse.json({
    articles,
    nextCursor: blog.articles.pageInfo.hasNextPage ? blog.articles.pageInfo.endCursor : null,
  });
}
