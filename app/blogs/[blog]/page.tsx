import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getBlogByHandle } from '@/lib/shopify';
import { blogs as inventoryBlogs } from '@/lib/inventory';
import { capTitle, truncDescription, firstNonEmpty, stripBrandSuffix } from '@/lib/seo';
import { Icon } from '@/app/_components/icon';

type Params = {
  params: Promise<{ blog: string }>;
  searchParams: Promise<{ after?: string }>;
};

// Blog index uses ?after= cursor — dynamic per request.
export const dynamic = 'force-dynamic';

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
const SITE = 'https://mattressstoreslosangeles.com';
const PER_PAGE = 12;

export function generateStaticParams() {
  if (!SHOPIFY_CONFIGURED) return [];
  return inventoryBlogs.map((b) => ({ blog: b.handle }));
}

export async function generateMetadata(props: { params: Promise<Params['params']> }): Promise<Metadata> {
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) return { title: 'Blog' };
  const blog = await getBlogByHandle({ handle: params.blog, first: 1 }).catch(() => null);
  if (!blog) return { title: 'Blog not found', robots: { index: false, follow: false } };
  const title = capTitle(firstNonEmpty(blog.seo.title, `${blog.title} — LA Mattress Store`));
  const description = truncDescription(
    firstNonEmpty(blog.seo.description, `Articles from ${blog.title} — LA Mattress Store.`),
  );
  const url = `/blogs/${blog.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description },
  };
}

export default async function BlogIndexPage(props: Params) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  if (!SHOPIFY_CONFIGURED) notFound();
  const after = searchParams.after ?? null;
  const blog = await getBlogByHandle({ handle: params.blog, first: PER_PAGE, after }).catch(() => null);
  if (!blog) notFound();

  const articles = blog.articles.nodes;
  const displayTitle = stripBrandSuffix(blog.title);
  const nextHref =
    blog.articles.pageInfo.hasNextPage && blog.articles.pageInfo.endCursor
      ? `/blogs/${blog.handle}?${new URLSearchParams({ after: blog.articles.pageInfo.endCursor }).toString()}`
      : null;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: blog.title },
    ],
  };

  const blogLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: blog.title,
    url: `${SITE}/blogs/${blog.handle}`,
    publisher: { '@type': 'Organization', name: 'LA Mattress Store', url: SITE },
  };

  return (
    <main className="container">
      <header className="lp-hero" style={{ paddingBottom: 'var(--s-5)' }}>
        <nav className="lp-breadcrumbs">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <span>{displayTitle}</span>
        </nav>
        <div className="lp-hero-inner" style={{ marginTop: 'var(--s-5)' }}>
          <div className="lp-hero-copy">
            <div className="eyebrow">{displayTitle}</div>
            <h1 className="h1">{displayTitle}</h1>
          </div>
        </div>
      </header>

      <section className="section">
        {articles.length === 0 ? (
          <p className="muted" style={{ maxWidth: '60ch' }}>
            No articles published yet. <Link href="/collections/mattresses" className="link-arrow">
              Shop mattresses <Icon name="arrow-right" size={14} />
            </Link>.
          </p>
        ) : (
          <>
            <ul className="blog-list" aria-label="Articles">
              {articles.map((a, idx) => (
                <li key={a.id} className="blog-list-item">
                  <Link href={`/blogs/${blog.handle}/${a.handle}`} className="blog-card">
                    <div className="ph blog-card-img" style={{ aspectRatio: '16 / 10' }}>
                      {a.image ? (
                        <Image
                          src={a.image.url}
                          alt={a.image.altText ?? a.title}
                          width={800}
                          height={500}
                          sizes="(max-width: 760px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                          priority={!after && idx < 3}
                          loading={!after && idx < 3 ? 'eager' : 'lazy'}
                        />
                      ) : <span className="ph-label">[Article image]</span>}
                    </div>
                    <div className="blog-card-meta">
                      <time className="muted blog-card-date" dateTime={a.publishedAt}>
                        {new Date(a.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </time>
                      <h2 className="blog-card-title">{a.title}</h2>
                      {a.excerpt ? <p className="blog-card-excerpt muted">{a.excerpt}</p> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="plp-pagination">
              {nextHref ? (
                <Link href={nextHref} className="btn btn-ghost btn-lg">
                  Load more <Icon name="arrow-right" size={16} />
                </Link>
              ) : null}
            </div>
          </>
        )}
      </section>

      <script id="ld-blog" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogLd) }} />
      <script id="ld-breadcrumb-blog" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
