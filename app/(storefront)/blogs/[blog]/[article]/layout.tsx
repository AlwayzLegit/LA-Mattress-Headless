import { getArticleByHandle } from '@/lib/shopify';
import { getArticleJsonLd } from '@/lib/article-jsonld';

/**
 * Segment layout for /blogs/[blog]/[article]. Emits BlogPosting +
 * BreadcrumbList JSON-LD HERE — the layout is NOT inside page.tsx's
 * in-page <Suspense fallback={ArticleSkeleton}> fast-path, so the
 * id-bearing <script>s can't be caught in React's streaming-source
 * (#S:0) leftover and duplicated on hard load (cowork QA; same fix
 * class as #166). getArticleByHandle is React.cache()-memoized, so
 * this and the page's ArticleBody share one Storefront request.
 */
export default async function ArticleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ blog: string; article: string }>;
}) {
  const { blog, article } = await params;
  const a = await getArticleByHandle(blog, article).catch(() => null);
  const ld = a ? getArticleJsonLd(a) : [];

  return (
    <>
      {ld.map(({ key, data }) => (
        <script
          key={key}
          id={key}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
      {children}
    </>
  );
}
