/**
 * Blog-article JSON-LD, rendered by app/blogs/[blog]/[article]/layout.tsx
 * — OUTSIDE the in-page <Suspense fallback={ArticleSkeleton}> fast-path
 * in page.tsx. Same fix class as lib/page-jsonld.ts (#166): when the
 * id-bearing <script>s lived in the suspended subtree, React's hidden
 * streaming-source (#S:0) was left in the DOM on hard load, duplicating
 * BlogPosting + BreadcrumbList (cowork QA).
 *
 * Objects + derivations reproduced verbatim from ArticleView (page.tsx).
 * countWordsFromHtml is duplicated here (3 trivial pure lines) rather
 * than sharing a util — the page keeps its own copy for read-time.
 */
import type { getArticleByHandle } from '@/lib/shopify';
import { firstNonEmpty } from '@/lib/seo';

type Article = NonNullable<Awaited<ReturnType<typeof getArticleByHandle>>>;
export type ArticleLd = { key: string; data: unknown };

const SITE = 'https://www.mattressstoreslosangeles.com';

function countWordsFromHtml(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').length;
}

export function getArticleJsonLd(article: Article): ArticleLd[] {
  const url = `${SITE}/blogs/${article.blog.handle}/${article.handle}`;
  const wordCount = countWordsFromHtml(article.contentHtml);
  const ldDescription = firstNonEmpty(
    article.seo.description,
    article.excerpt,
    article.title,
  );

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'en-US',
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
    articleSection: article.blog.title,
    ...(wordCount ? { wordCount } : {}),
    ...(article.tags.length ? { keywords: article.tags.join(', ') } : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: article.blog.title, item: `${SITE}/blogs/${article.blog.handle}` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  };

  return [
    { key: 'ld-article', data: articleLd },
    { key: 'ld-breadcrumb-article', data: breadcrumbLd },
  ];
}
