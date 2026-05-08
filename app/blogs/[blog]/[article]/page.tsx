import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getArticleByHandle } from '@/lib/shopify';
import type { Article } from '@/lib/shopify';
import { blogs as inventoryBlogs, findBlog } from '@/lib/inventory';
import { capTitle, truncDescription, firstNonEmpty, stripBrandSuffix, toSentenceCase } from '@/lib/seo';
import { sanitizeShopifyHtml } from '@/lib/sanitize';
import { injectHeadingIds } from '@/lib/article-toc';
import { Icon } from '@/app/_components/icon';
import { ArticleSkeleton } from './skeleton';
import { ArticleToc } from './article-toc';

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
  if (!article) return { title: 'Article not found' };
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

/**
 * Article — design handoff §Guide detail. Renders as:
 *
 *   <section .gd-head>           breadcrumbs + meta + h1 + lede
 *   <div .container>
 *     <div .gd-article>          3-col grid (220 / fluid / 220)
 *       <aside .gd-toc>          sticky TOC built from the article's H2s
 *       <article .gd-body>       sanitized Shopify HTML, with IDs on H2s
 *       <aside .gd-side>         "Skip the reading" + "Read these next"
 *   <section .gd-cta-band>       footer band linking back to the index
 *
 * On <=980px the side rails collapse and the article is single-column.
 */
function ArticleView({ article }: { article: Article }) {
  const url = `${SITE}/blogs/${article.blog.handle}/${article.handle}`;
  const sanitized = sanitizeShopifyHtml(article.contentHtml);
  const { html: bodyHtml, headings } = injectHeadingIds(sanitized);
  const readMinutes = estimateReadMinutes(article.contentHtml);
  const related = findRelatedArticles(article);

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

  const articleDisplayTitle = toSentenceCase(stripBrandSuffix(article.title));
  const blogDisplayTitle = toSentenceCase(stripBrandSuffix(article.blog.title));
  const updatedLabel = new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <>
      <section className="gd-head">
        <div className="container">
          <nav className="lp-breadcrumbs">
            <Link href="/">Home</Link>
            <span className="sep">/</span>
            <Link href={`/blogs/${article.blog.handle}`}>{blogDisplayTitle}</Link>
            <span className="sep">/</span>
            <span>{articleDisplayTitle}</span>
          </nav>
          <div className="gd-head-inner">
            <div className="gd-head-meta">
              <span>{blogDisplayTitle}</span>
              {readMinutes > 0 ? (
                <>
                  <span className="gd-head-meta-sep" aria-hidden="true">·</span>
                  <span>{readMinutes} min read</span>
                </>
              ) : null}
              <span className="gd-head-meta-sep" aria-hidden="true">·</span>
              <span>Updated {updatedLabel}</span>
            </div>
            <h1>{articleDisplayTitle}</h1>
            {article.excerpt ? <p className="gd-head-lede">{article.excerpt}</p> : null}
          </div>
        </div>
      </section>

      {article.image ? (
        <div className="container" style={{ marginTop: 'var(--s-7)' }}>
          <figure style={{ maxWidth: 1080, margin: '0 auto' }}>
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
        </div>
      ) : null}

      <div className="container">
        <div className="gd-article">
          <ArticleToc headings={headings} />


          <article className="gd-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

          <aside className="gd-side" aria-label="Related actions">
            <div className="gd-side-card">
              <h4>Skip the reading</h4>
              <Link href="/sleep-quiz">Take the sleep quiz <Icon name="arrow-right" size={14} /></Link>
              <Link href="/pages/mattress-store-locations">Talk to a real human <Icon name="arrow-right" size={14} /></Link>
              <Link href="/compare">Compare 2-3 mattresses <Icon name="arrow-right" size={14} /></Link>
            </div>
            {related.length > 0 ? (
              <div className="gd-side-card gd-side-card-dark gd-side-card-stack">
                <h4>Read these next</h4>
                <p>More from {article.blog.title}.</p>
                {related.slice(0, 3).map((r) => (
                  <Link key={r.handle} href={`/blogs/${article.blog.handle}/${r.handle}`}>
                    <span>{r.title ?? r.handle.replace(/-/g, ' ')}</span>
                    <Icon name="arrow-right" size={14} />
                  </Link>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <section className="gd-cta-band">
        <div className="container gd-cta-band-inner">
          <div>
            <h3>Read more from {article.blog.title}.</h3>
            <p>Buying guides and sleep advice — no email signup required.</p>
          </div>
          <div className="gd-cta-actions">
            <Link href={`/blogs/${article.blog.handle}`} className="btn btn-primary btn-lg">
              All articles <Icon name="arrow-right" size={16} />
            </Link>
            <Link href="/sleep-quiz" className="btn btn-ghost btn-lg">Take the quiz instead</Link>
          </div>
        </div>
      </section>

      <script id="ld-article" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script id="ld-breadcrumb-article" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </>
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
