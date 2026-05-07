import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getArticleByHandle } from '@/lib/shopify';
import type { Article } from '@/lib/shopify';
import { blogs as inventoryBlogs, findBlog } from '@/lib/inventory';
import { capTitle, truncDescription, firstNonEmpty, stripBrandSuffix } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { Icon } from '@/app/_components/icon';
import { ArticleSkeleton } from './skeleton';

type Params = { params: Promise<{ blog: string; article: string }> };

export const revalidate = 600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
const SITE = 'https://mattressstoreslosangeles.com';

// Pre-render the published article handles from the inventory snapshot.
// `dynamicParams = true` still serves articles published since the last
// pull on demand via ISR. Re-run `node scripts/pull-articles-via-storefront.mjs`
// to refresh after publishing new posts.
export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  return inventoryBlogs.flatMap((b) =>
    (b.articles ?? []).map((a) => ({ blog: b.handle, article: a.handle })),
  );
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Article' };
  const article = await getArticleByHandle(params.blog, params.article).catch(() => null);
  if (!article) return { title: 'Article not found', robots: { index: false, follow: false } };
  const title = capTitle(firstNonEmpty(article.seo.title, article.title));
  const description = truncDescription(
    firstNonEmpty(
      article.seo.description,
      article.excerpt,
      `${article.title} — LA Mattress Store buying guide`,
    ),
  );
  const url = `/blogs/${article.blog.handle}/${article.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      publishedTime: article.publishedAt,
      authors: article.author ? [article.author.name] : [],
      images: article.image ? [{ url: article.image.url, alt: article.image.altText ?? article.title }] : [],
    },
  };
}

function findArticle(blog: string, article: string): boolean {
  const b = inventoryBlogs.find((x) => x.handle === blog);
  if (!b) return false;
  return (b.articles ?? []).some((a) => a.handle === article);
}

export default async function ArticlePage(props: Params) {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();

  // Same hybrid pattern as PDP/PLP: known (blog, article) tuples take the
  // Suspense fast-path with skeleton; unknown handles fall through to the
  // sync fetch so notFound() emits a real 404.
  if (findArticle(params.blog, params.article)) {
    return (
      <Suspense fallback={<ArticleSkeleton />}>
        <ArticleBody blog={params.blog} article={params.article} />
      </Suspense>
    );
  }

  const article = await getArticleByHandle(params.blog, params.article).catch(() => null);
  if (!article) notFound();
  return <ArticleView article={article} />;
}

async function ArticleBody({ blog, article }: { blog: string; article: string }) {
  const a = await getArticleByHandle(blog, article).catch(() => null);
  if (!a) notFound();
  return <ArticleView article={a} />;
}

function ArticleView({ article }: { article: Article }) {
  const url = `${SITE}/blogs/${article.blog.handle}/${article.handle}`;
  const readMinutes = estimateReadMinutes(article.contentHtml);
  const related = findRelatedArticles(article);

  // BlogPosting description prefers Shopify's SEO field (the merchant's
  // deliberate description_tag metafield, surfaced via Storefront `seo`)
  // over the article excerpt, falling back to the article title. Same
  // priority order as the page's <meta name="description">.
  const ldDescription = firstNonEmpty(
    article.seo.description,
    article.excerpt,
    article.title,
  );

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: article.title,
    ...(ldDescription ? { description: ldDescription } : {}),
    datePublished: article.publishedAt,
    image: article.image ? [article.image.url] : undefined,
    author: article.author ? { '@type': 'Person', name: article.author.name } : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'LA Mattress Store',
      logo: { '@type': 'ImageObject', url: `${SITE}/assets/la-mattress-logo.png` },
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: article.blog.title, item: `${SITE}/blogs/${article.blog.handle}` },
      { '@type': 'ListItem', position: 3, name: article.title },
    ],
  };

  const articleDisplayTitle = stripBrandSuffix(article.title);
  const blogDisplayTitle = stripBrandSuffix(article.blog.title);

  return (
    <main className="container">
      <article className="article" style={{ padding: 'var(--s-7) 0 var(--s-9)' }}>
        <nav className="lp-breadcrumbs">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href={`/blogs/${article.blog.handle}`}>{blogDisplayTitle}</Link>
          <span className="sep">/</span>
          <span>{articleDisplayTitle}</span>
        </nav>

        <header className="article-header" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>{blogDisplayTitle}</div>
          <h1 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>{articleDisplayTitle}</h1>
          <div className="article-meta muted">
            <time dateTime={article.publishedAt}>
              {new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
            {article.author?.name ? <> · <span>By {article.author.name}</span></> : null}
            {readMinutes > 0 ? <> · <span>{readMinutes} min read</span></> : null}
          </div>
        </header>

        {article.image ? (
          <figure className="article-cover" style={{ maxWidth: 1080, margin: 'var(--s-6) auto 0' }}>
            <Image
              src={article.image.url}
              alt={article.image.altText ?? article.title}
              width={1600}
              height={900}
              sizes="(max-width: 1080px) 100vw, 1080px"
              style={{ width: '100%', height: 'auto', borderRadius: 'var(--r-3)', objectFit: 'cover' }}
              priority
            />
          </figure>
        ) : null}

        <div
          className="rte article-body"
          style={{ maxWidth: 720, margin: 'var(--s-7) auto 0' }}
          dangerouslySetInnerHTML={{ __html: sanitizeShopifyHtml(article.contentHtml) }}
        />

        <footer className="article-foot" style={{ maxWidth: 720, margin: 'var(--s-7) auto 0', paddingTop: 'var(--s-5)', borderTop: '1px solid var(--line)' }}>
          <Link href={`/blogs/${article.blog.handle}`} className="link-arrow">
            <Icon name="arrow-left" size={14} /> More from {article.blog.title}
          </Link>
        </footer>

        {related.length > 0 ? (
          <section className="article-related" aria-labelledby="article-related-heading" style={{ maxWidth: 720, margin: 'var(--s-7) auto 0' }}>
            <div className="eyebrow">Keep reading</div>
            <h2 id="article-related-heading" className="h2" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>More from {article.blog.title}</h2>
            <ul className="article-related-list">
              {related.map((r) => (
                <li key={r.handle}>
                  <Link href={`/blogs/${article.blog.handle}/${r.handle}`} className="article-related-row">
                    <span className="article-related-title">{r.title ?? r.handle.replace(/-/g, ' ')}</span>
                    {r.publishedAt ? (
                      <time dateTime={r.publishedAt} className="muted">
                        {new Date(r.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </time>
                    ) : null}
                    <Icon name="arrow-right" size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <script id="ld-article" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script id="ld-breadcrumb-article" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}

/**
 * Rough read-time estimate from HTML content. Strips tags + counts words,
 * divides by 220 wpm (a slightly fast pace, biased so the displayed number
 * doesn't oversell long-form posts). Returns 0 for empty content so the
 * caller can drop the chip entirely.
 */
function estimateReadMinutes(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  const words = text.split(' ').length;
  return Math.max(1, Math.round(words / 220));
}

/** Pull up to 4 sibling articles from the same blog (excluding the current one). */
function findRelatedArticles(article: Article): { handle: string; title?: string; publishedAt?: string | null }[] {
  const blog = findBlog(article.blog.handle);
  if (!blog?.articles) return [];
  return blog.articles
    .filter((a) => a.handle !== article.handle && a.isPublished !== false)
    .sort((a, b) => {
      const ad = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bd = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bd - ad;
    })
    .slice(0, 4);
}
