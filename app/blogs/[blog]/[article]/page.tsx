import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getArticleByHandle } from '@/lib/shopify';
import type { Article } from '@/lib/shopify';
import { blogs as inventoryBlogs } from '@/lib/inventory';
import { capTitle, truncDescription, firstNonEmpty } from '@/lib/seo';
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

function ArticleView({ article }: { article: Article }) {
  const url = `${SITE}/blogs/${article.blog.handle}/${article.handle}`;

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: article.title,
    description: article.excerpt ?? undefined,
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

  return (
    <main className="container">
      <article className="article" style={{ padding: 'var(--s-7) 0 var(--s-9)' }}>
        <nav className="lp-breadcrumbs">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href={`/blogs/${article.blog.handle}`}>{article.blog.title}</Link>
          <span className="sep">/</span>
          <span>{article.title}</span>
        </nav>

        <header className="article-header" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>{article.blog.title}</div>
          <h1 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>{article.title}</h1>
          <div className="article-meta muted">
            <time dateTime={article.publishedAt}>
              {new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
            {article.author?.name ? <> · <span>By {article.author.name}</span></> : null}
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
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />

        <footer className="article-foot" style={{ maxWidth: 720, margin: 'var(--s-7) auto 0', paddingTop: 'var(--s-5)', borderTop: '1px solid var(--line)' }}>
          <Link href={`/blogs/${article.blog.handle}`} className="link-arrow">
            <Icon name="arrow-left" size={14} /> More from {article.blog.title}
          </Link>
        </footer>
      </article>

      <script id="ld-article" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script id="ld-breadcrumb-article" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
