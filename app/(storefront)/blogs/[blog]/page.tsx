import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { getBlogByHandle } from '@/lib/shopify';
import { blogs as inventoryBlogs } from '@/lib/inventory';
import { capTitle, truncDescription, firstNonEmpty, stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { blogIntroFor } from '@/lib/blog-content';
import { isNoindexBlogIndex } from '@/lib/noindex-articles';
import { displayAuthorName } from '@/lib/article-author';
import { resolveRedirectPath } from '@/lib/sanitize';
import { Icon } from '@/app/_components/icon';
import { SITE_URL } from '@/lib/site-config';
import { BlogArticleFeed, type ArticleCard } from './blog-article-feed';
import { BlogArchiveList } from './blog-archive-list';

/**
 * Every published, non-redirected article in this blog, sorted A–Z, as a
 * flat list of `{ handle, title }`. Sourced from the committed inventory
 * snapshot (static — no Shopify fetch), so it renders on the very first
 * paint regardless of the live `?after=` cursor slice.
 *
 * Why this lives on the blog index: the card grid is paginated 12-at-a-
 * time via `?after=` cursors (which are noindex), so older articles sit
 * 4+ "Load more" clicks deep — SEMrush "Page crawl depth" (>3 clicks)
 * flagged ~30 buyer's-guide posts at depth 40+. The mega HTML sitemap
 * (/pages/sitemap) lists everything but carries ~2,000 links on one page,
 * so crawlers don't traverse all of them. Rendering each blog's complete
 * archive HERE gives every article a clean depth-3 path
 * (home → /blogs → /blogs/[blog] → article) with a far smaller, topically
 * focused link set per page. Redirected siblings are dropped so the list
 * never links through a 301 (same guard the related-articles rail uses).
 */
function fullArchiveFor(blogHandle: string): { handle: string; title: string }[] {
  const inv = inventoryBlogs.find((b) => b.handle === blogHandle);
  if (!inv?.articles) return [];
  return inv.articles
    .filter((a) => a.isPublished !== false)
    .filter((a) => {
      const path = `/blogs/${blogHandle}/${a.handle}`;
      return resolveRedirectPath(path) === path;
    })
    .map((a) => ({ handle: a.handle, title: a.title ?? a.handle.replace(/-/g, ' ') }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

type Params = {
  params: Promise<{ blog: string }>;
  searchParams: Promise<{ after?: string }>;
};

// Blog index uses ?after= cursor — dynamic per request.
export const dynamic = 'force-dynamic';

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
const SITE = SITE_URL; // audit codeq-site-const-dup-10: single source, apex-guarded
const PER_PAGE = 12;

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  return inventoryBlogs.map((b) => ({ blog: b.handle }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  if (!SHOPIFY_CONFIGURED) return { title: 'Blog' };
  const blog = await getBlogByHandle({ handle: params.blog, first: 1 }).catch(() => null);
  if (!blog) return { title: 'Blog not found' };
  const title = capTitle(firstNonEmpty(blog.seo.title, `${blog.title}, LA Mattress Store`));
  const description = truncDescription(
    firstNonEmpty(blog.seo.description, `Articles from ${blog.title}, LA Mattress Store.`),
  );
  const url = `/blogs/${blog.handle}`;
  // Paginated cursor URLs (`?after=...`) duplicate the blog index with
  // a different slice of articles. The canonical link already points
  // back to the bare URL, but SEMrush still flagged the cursor URLs for
  // low word count (the visible body is the same skeleton + article
  // cards). robots: noindex (follow) blocks indexing of cursor URLs
  // while still letting Googlebot follow the links to articles —
  // standard Pagination SEO pattern.
  const isPaginated = Boolean(searchParams?.after);
  // Thin single-article blog indexes (extra-info) get the same
  // noindex,follow treatment as cursor pages — SEMrush 20260611 "Low
  // word count". Articles inside the blog remain indexable.
  const isThinIndex = isNoindexBlogIndex(blog.handle);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    ...(isPaginated || isThinIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      // Blog index has no per-blog cover image. Reference the
      // file-system OG convention (app/opengraph-image.tsx) explicitly
      // so coverless blog landing pages still serve the brand card —
      // matches the Phase 180 fallback already on collection / article /
      // PDP routes.
      images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
  };
}

/**
 * Blog index — design handoff §Guides Index. Lp-hero with eyebrow + h1 +
 * lede + meta tiles, then a `.gd-grid` of `.gd-card`s. Each card is a
 * 4:3 hero image, a mono category · read-time line, the article title,
 * a 3-line excerpt clamp, and a foot row with the published date and a
 * red "Read →" arrow. Pagination preserved with the design's button.
 */
export default async function BlogIndexPage(props: Params) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();
  const after = searchParams.after ?? null;
  // Upstream failures throw (5xx / stale-ISR-keeps-serving) — only a genuine
  // Shopify "no such handle" (null) may 404. See the pages/[handle] note.
  const blog = await getBlogByHandle({ handle: params.blog, first: PER_PAGE, after });
  if (!blog) notFound();

  const articles = blog.articles.nodes;
  const archive = fullArchiveFor(params.blog);
  const displayTitle = toSentenceCase(stripBrandSuffix(blog.title));
  // Seed the infinite-scroll feed with the first slice, server-rendered
  // for LCP + crawlability. Subsequent slices are appended client-side
  // from /api/blog-articles (no page navigation). Author name + date
  // label are pre-computed here so the client renders plain strings and
  // can't drift from this SSR markup at hydration.
  const initialCards: ArticleCard[] = articles.map((a) => ({
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
  const initialCursor = blog.articles.pageInfo.hasNextPage
    ? blog.articles.pageInfo.endCursor
    : null;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: blog.title, item: `${SITE}/blogs/${blog.handle}` },
    ],
  };

  const blogLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: blog.title,
    url: `${SITE}/blogs/${blog.handle}`,
    inLanguage: 'en-US',
    publisher: { '@type': 'Organization', name: 'LA Mattress Store', url: SITE },
  };

  return (
    <main>
      <section className="lp-hero">
        <div className="container">
          <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep" aria-hidden="true">/</span>
            <span>{displayTitle}</span>
          </nav>
          <div className="lp-hero-inner lp-hero-inner-stacked">
            <div className="lp-hero-copy">
              <div className="eyebrow">Articles · {displayTitle}</div>
              <h1 className="h-display">{displayTitle}</h1>
              {/* Phase 260c: per-blog descriptive intro replaces the prior
                  generic "Buying guides and sleep advice" lede. Gives each
                  blog index unique category copy (boosts text-to-HTML
                  ratio, clears SEMrush low-word-count flag on
                  /blogs/sleep-health and adjacent indexes) and gives
                  crawlers a clear category signal. Sourced from
                  lib/blog-content.ts. */}
              <p className="lp-hero-lede" style={{ maxWidth: '72ch' }}>
                {blogIntroFor(blog.handle)}
              </p>
              <div className="lp-hero-meta">
                <span><strong>{archive.length > 0 ? archive.length : articles.length}</strong> articles</span>
                <span><strong>5</strong> LA showrooms</span>
                <span><strong>No</strong> email signup required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {articles.length === 0 ? (
            <p className="muted" style={{ maxWidth: '60ch' }}>
              No articles published yet.{' '}
              <Link href="/collections/mattresses" className="link-arrow">
                Shop mattresses <Icon name="arrow-right" size={14} />
              </Link>
              .
            </p>
          ) : (
            <>
              {/* Card titles below are h3s; without an h2 the outline
                  jumps h1->h3 for every card (audit a11y-headings-05).
                  Visually hidden, the grid is self-evident sighted. */}
              <h2 className="sr-only">Featured and recent articles</h2>
              {/* Phase: infinite-scroll feed. The first slice is
                  server-rendered here; subsequent slices append
                  client-side (IntersectionObserver + a "Load more"
                  fallback button) via /api/blog-articles. Replaces the
                  old `?after=` <Link> that navigated to a fresh page and
                  reset the visible cards. */}
              <BlogArticleFeed
                blogHandle={blog.handle}
                blogTitle={blog.title}
                initialArticles={initialCards}
                initialCursor={initialCursor}
              />
            </>
          )}
        </div>
      </section>

      {archive.length > articles.length ? (
        <section className="section" aria-labelledby="blog-archive">
          <div className="container">
            <h2 id="blog-archive" className="h2">All {displayTitle} articles</h2>
            <p className="muted" style={{ maxWidth: '64ch', marginTop: 'var(--s-2)' }}>
              The complete archive, every article in {displayTitle}, A to Z.
            </p>
            {/* Every link stays in the SSR DOM (the depth-3 crawl-path
                guarantee), but the overflow past the first chunk is
                collapsed behind a disclosure so a 600-article blog is no
                longer a wall of links. See blog-archive-list.tsx. */}
            <BlogArchiveList blogHandle={blog.handle} items={archive} />
          </div>
        </section>
      ) : null}

      <script id="ld-blog" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogLd) }} />
      <script id="ld-breadcrumb-blog" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
