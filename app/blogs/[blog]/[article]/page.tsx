import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

import { getArticleByHandle } from '@/lib/shopify';
import { Icon } from '@/app/_components/icon';

type Params = { params: Promise<{ blog: string; article: string }> };

export const revalidate = 600;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
const SITE = 'https://mattressstoreslosangeles.com';

// Article handles aren't enumerated in the inventory snapshot yet —
// scripts/pull-inventory.mjs needs read_content scope to populate them.
// Until then, articles render dynamically (dynamicParams = true).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Article' };
  const article = await getArticleByHandle(params.blog, params.article).catch(() => null);
  if (!article) return { title: 'Article not found' };
  const title = article.seo.title ?? article.title;
  const description =
    article.seo.description ??
    (article.excerpt && article.excerpt.length > 160 ? `${article.excerpt.slice(0, 157)}...` : article.excerpt) ??
    `${article.title} — LA Mattress Store`;
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

export default async function ArticlePage(props: Params) {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();
  const article = await getArticleByHandle(params.blog, params.article).catch(() => null);
  if (!article) notFound();

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

      <Script id="ld-article" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <Script id="ld-breadcrumb-article" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
