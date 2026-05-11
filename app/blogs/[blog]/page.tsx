import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getBlogByHandle } from '@/lib/shopify';
import { blogs as inventoryBlogs } from '@/lib/inventory';
import { capTitle, truncDescription, firstNonEmpty, stripBrandSuffix, toSentenceCase } from '@/lib/seo';
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
  if (!blog) return { title: 'Blog not found' };
  const title = capTitle(firstNonEmpty(blog.seo.title, `${blog.title} — LA Mattress Store`));
  const description = truncDescription(
    firstNonEmpty(blog.seo.description, `Articles from ${blog.title} — LA Mattress Store.`),
  );
  const url = `/blogs/${blog.handle}`;
  return {
    title,
    description,
    alternates: { canonical: url },
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
  const blog = await getBlogByHandle({ handle: params.blog, first: PER_PAGE, after }).catch(() => null);
  if (!blog) notFound();

  const articles = blog.articles.nodes;
  const displayTitle = toSentenceCase(stripBrandSuffix(blog.title));
  const nextHref =
    blog.articles.pageInfo.hasNextPage && blog.articles.pageInfo.endCursor
      ? `/blogs/${blog.handle}?${new URLSearchParams({ after: blog.articles.pageInfo.endCursor }).toString()}`
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
    <>
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
              <p className="lp-hero-lede">
                Buying guides and sleep advice from the team that fits mattresses for a living. No SEO fluff —
                this is what we tell shoppers when they walk into the showroom.
              </p>
              <div className="lp-hero-meta">
                <span><strong>{articles.length}</strong> articles on this page</span>
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
              <div className="gd-grid" aria-label="Articles">
                {articles.map((a, idx) => {
                  const cat = blog.title;
                  const date = new Date(a.publishedAt);
                  const dateLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                  return (
                    <Link
                      key={a.id}
                      href={`/blogs/${blog.handle}/${a.handle}`}
                      className="gd-card"
                    >
                      <div className="gd-card-img">
                        {a.image ? (
                          <Image
                            src={a.image.url}
                            alt={a.image.altText ?? a.title}
                            fill
                            sizes="(max-width: 760px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            style={{ objectFit: 'cover' }}
                            priority={!after && idx < 3}
                          />
                        ) : (
                          <span className="ph-label" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>[Article image]</span>
                        )}
                      </div>
                      <div className="gd-card-body">
                        <div className="gd-card-meta">
                          <span>{cat}</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={a.publishedAt}>{dateLabel}</time>
                        </div>
                        <h3>{a.title}</h3>
                        {a.excerpt ? <p className="gd-card-excerpt">{a.excerpt}</p> : null}
                        <div className="gd-card-foot">
                          <span className="muted">
                            {a.author?.name ? `By ${a.author.name}` : 'LA Mattress'}
                          </span>
                          <span className="arrow">
                            Read <Icon name="arrow-right" size={14} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {nextHref ? (
                <div className="plp-pagination" style={{ marginTop: 'var(--s-7)' }}>
                  <Link href={nextHref} className="btn btn-ghost btn-lg">
                    Load more <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <script id="ld-blog" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogLd) }} />
      <script id="ld-breadcrumb-blog" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </>
  );
}
