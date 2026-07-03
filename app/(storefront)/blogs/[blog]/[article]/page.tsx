import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { getArticleByHandle } from '@/lib/shopify';
import type { Article } from '@/lib/shopify';
import { blogs as inventoryBlogs, findBlog } from '@/lib/inventory';
import { truncDescription, firstNonEmpty, stripBrandSuffix, toSentenceCase, ensureTitleDistinctFromH1 } from '@/lib/seo';
import { isNoindexArticle } from '@/lib/noindex-articles';
import { sanitizeShopifyHtml, resolveRedirectPath } from '@/lib/sanitize';
import { injectHeadingIds } from '@/lib/article-toc';
import { autoLinkArticleBody } from '@/lib/article-autolink';
import { ArticleEnrichment } from '@/app/_components/sections/article-enrichment';
import { ArticleShopRail } from '@/app/_components/sections/article-shop-rail';
import { displayAuthorName } from '@/lib/article-author';
import { Icon } from '@/app/_components/icon';
import { ArticleSkeleton } from './skeleton';
import { ArticleToc } from './article-toc';
import { SITE_URL } from '@/lib/site-config';

type Params = { params: Promise<{ blog: string; article: string }> };

// 24h ISR window. Articles change rarely after publish (typo fixes,
// occasional copy edits). Sentry data showed p75 TTFB at 5.25s with
// the previous 10-min window — most requests were hitting on-demand
// regeneration instead of static-cache. Bumping to 86400s lets the
// CDN serve the prerendered HTML for a full day before triggering
// a background revalidation, which moves p75 TTFB toward static-cache
// numbers (<300ms). Trade-off: merchant edits are visible up to 24h
// later — no Shopify webhook exists for `articles/update`, so this
// is the only invalidation lever for article body changes. If real-
// time freshness matters, set up a Shopify Flow that POSTs to
// /api/revalidate with `topic=articles/update` (the route handler
// already maps that topic to `article:<blog>/<handle>` tag bust).
export const revalidate = 86400;
export const dynamicParams = true;

const SHOPIFY_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
const SITE = SITE_URL; // audit codeq-site-const-dup-10: single source, apex-guarded

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
  // Phase 289: when the merchant hasn't set a custom seo.title (the
  // common case for legacy articles), append " | LA Mattress" so the
  // <title> text differs from the H1.
  //
  // Phase 281 switched articles to `title: { absolute: title }` which
  // dropped the layout's " · LA Mattress Store" suffix and fixed
  // "Title too long". Side effect: the title text became identical
  // to the H1 modulo case (H1 sentence-cases stripped brand;
  // title used the original Title Case). The May 15 SEMrush re-audit
  // flagged 323 blog articles for "Duplicate content in h1 and title"
  // — case-insensitive comparison sees them as the same string.
  //
  // Suffix the title fallback (NOT the H1) with the primary ranking
  // phrase "LA Mattress Store" so the <title> is both distinct from the
  // H1 (which is the brand-stripped, sentence-cased article title) and
  // keyword-bearing — a bare " | LA Mattress" brand append still reads
  // as H1 + boilerplate (SEMrush near-duplicate). stripBrandSuffix
  // first so an article title that already carries a brand suffix
  // doesn't end up double-branded. Merchant-set seo.title still wins.
  const titleFallback = `${stripBrandSuffix(article.title)} | LA Mattress Store`;
  // ensureTitleDistinctFromH1 guarantees the <title> differs from the
  // rendered <h1> (toSentenceCase(stripBrandSuffix(article.title))) even
  // when the merchant set seo.title to the headline — appending the
  // keyword-bearing brand suffix only when it would otherwise collapse.
  // Caps to TITLE_MAX internally (replaces the prior capTitle call).
  const title = ensureTitleDistinctFromH1(firstNonEmpty(article.seo.title, titleFallback), article.title);
  const description = truncDescription(
    firstNonEmpty(
      article.seo.description,
      article.excerpt,
      `${article.title} — LA Mattress Store buying guide`,
    ),
  );
  const url = `/blogs/${article.blog.handle}/${article.handle}`;
  // Programmatic, near-duplicate doorway-style posts the legacy site
  // deliberately blocked from crawling. Keep them out of the index
  // (follow:true so internal link equity still flows). See
  // lib/noindex-articles.ts.
  const noindex = isNoindexArticle(article.blog.handle, article.handle);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    // Next normalizes this and emits bare `noindex` (follow is the
    // default it omits) — the idiomatic object form documents intent
    // accurately; the string form misleadingly implied a literal
    // "noindex, follow" render.
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      publishedTime: article.publishedAt,
      // Normalize Shopify's auto-stamped "Shopify API" placeholder to
      // the editorial-team fallback — same rule as the article JSON-LD
      // (lib/article-jsonld.ts). Without this the og:article:author
      // meta tag leaks the placeholder into FB/LinkedIn unfurls and
      // gets picked up by SEMrush as a real author name.
      authors: [displayAuthorName(article.author)],
      // Reference app/opengraph-image.tsx explicitly when the article
      // has no cover image. Next.js's file-system OG convention is not
      // auto-merged into a route's openGraph block, so without this
      // an image-less article would emit no og:image at all.
      images: article.image
        ? [{ url: article.image.url, alt: article.image.altText ?? article.title }]
        : [{ url: '/opengraph-image', width: 1200, height: 630 }],
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
  const sanitized = sanitizeShopifyHtml(article.contentHtml);
  const withHeadings = injectHeadingIds(sanitized);
  const bodyHtml = autoLinkArticleBody(withHeadings.html);
  const { headings } = withHeadings;
  const wordCount = countWordsFromHtml(article.contentHtml);
  const readMinutes = wordCount ? Math.max(1, Math.round(wordCount / 220)) : 0;
  const related = findRelatedArticles(article);

  const articleDisplayTitle = toSentenceCase(stripBrandSuffix(article.title));
  const blogDisplayTitle = toSentenceCase(stripBrandSuffix(article.blog.title));
  const updatedLabel = new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <main>
      <section className="gd-head">
        <div className="container">
          <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep" aria-hidden="true">/</span>
            <Link href={`/blogs/${article.blog.handle}`}>{blogDisplayTitle}</Link>
            <span className="sep" aria-hidden="true">/</span>
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

      <ArticleShopRail />

      <ArticleEnrichment handle={article.handle} />

      <section className="section gd-related">
        <div className="container">
          <div className="eyebrow">Keep reading</div>
          <h2 className="h2 gd-related-h">Related guides</h2>
          <nav aria-label="Related guides">
            <ul className="gd-related-list">
              {related.slice(0, 5).map((r) => (
                <li key={r.handle}>
                  <Link href={`/blogs/${article.blog.handle}/${r.handle}`} className="link-arrow">
                    {r.title ?? r.handle.replace(/-/g, ' ')} <Icon name="arrow-right" size={14} />
                  </Link>
                </li>
              ))}
              <li>
                <Link href={`/blogs/${article.blog.handle}`} className="link-arrow">
                  All {article.blog.title} <Icon name="arrow-right" size={14} />
                </Link>
              </li>
              <li>
                <Link href="/sleep-quiz" className="link-arrow">
                  Take the 2-minute sleep quiz <Icon name="arrow-right" size={14} />
                </Link>
              </li>
              <li>
                <Link href="/pages/mattress-brands" className="link-arrow">
                  Brands we carry <Icon name="arrow-right" size={14} />
                </Link>
              </li>
              <li>
                <Link href="/collections/mattresses" className="link-arrow">
                  Shop all mattresses <Icon name="arrow-right" size={14} />
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </section>

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

    </main>
  );
}

/**
 * Rough read-time estimate from HTML content. Strips tags + counts words,
 * divides by 220 wpm (a slightly fast pace, biased so the displayed number
 * doesn't oversell long-form posts). Returns 0 for empty content so the
 * caller can drop the chip entirely.
 */
function countWordsFromHtml(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').length;
}

function estimateReadMinutes(html: string): number {
  const words = countWordsFromHtml(html);
  if (!words) return 0;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Pick up to 4 sibling articles from the same blog as "related".
 *
 * Coverage matters for SEO: the previous version always returned the 4
 * MOST-RECENT siblings, so every article in a blog linked to the same 4
 * newest posts — and every older post received zero inbound related-links.
 * That's the direct source of the Semrush 20260602 "Orphaned pages" (68)
 * and "Pages with only one internal link" (119) flags, almost all old blog
 * articles.
 *
 * Instead, sort the blog's articles stably (newest first) and take a
 * ROTATING window of the 4 siblings that follow the current article
 * (wrapping around). Article at index i links to i+1..i+4, so every
 * article j is linked from j-1..j-4 — i.e. ~4 inbound related-links each,
 * no orphans. Deterministic (stable per build), same-blog-relevant, and
 * the rendered links (sidebar + "Related guides") are crawlable.
 */
function findRelatedArticles(article: Article): { handle: string; title?: string; publishedAt?: string | null }[] {
  const blog = findBlog(article.blog.handle);
  if (!blog?.articles) return [];
  const sorted = blog.articles
    .filter((a) => a.isPublished !== false)
    // Drop siblings whose URL has been 301'd away (cluster consolidations:
    // 121 of 892 published inventory articles are shadowed by an entry in
    // redirects.json). The inventory snapshot still lists them, so the
    // rotation would otherwise render a link that hops through a 301 with
    // the OLD article's title pointing at a different destination —
    // SEMrush 20260611 counted these under "Permanent redirects" on pages
    // whose body links were already clean.
    .filter((a) => {
      const path = `/blogs/${blog.handle}/${a.handle}`;
      return resolveRedirectPath(path) === path;
    })
    .sort((a, b) => {
      const ad = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bd = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bd - ad || a.handle.localeCompare(b.handle); // tiebreak → fully stable order
    });
  const n = sorted.length;
  if (n <= 1) return [];
  const i = sorted.findIndex((a) => a.handle === article.handle);
  // Current article not in the inventory list (stale snapshot / deprecated
  // blog) — fall back to the first 4 so the section still renders.
  if (i === -1) return sorted.slice(0, 4);
  const out: typeof sorted = [];
  for (let k = 1; k <= 4 && k < n; k += 1) out.push(sorted[(i + k) % n]);
  return out;
}
