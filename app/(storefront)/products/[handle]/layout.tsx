import { getProductByHandle } from '@/lib/shopify';
import { getProductJsonLd } from '@/lib/product-jsonld';

/**
 * Segment layout for /products/[handle]. Emits the Product +
 * BreadcrumbList JSON-LD HERE — the layout is NOT inside page.tsx's
 * in-page <Suspense fallback={ProductSkeleton}> fast-path, so the
 * id-bearing <script>s can't be caught in React's streaming-source
 * (#S:0) leftover and duplicated on hard load (cowork QA; same fix
 * class as #166). getProductByHandle is React.cache()-memoized, so
 * this and the page's ProductBody share one Storefront request.
 *
 * Phase 299: PDP-scoped preconnect for the Judge.me widget endpoints.
 * The widget loads `afterInteractive` from cdnwidget.judge.me and
 * fetches review data from api.judge.me — neither is LCP-critical, so
 * these hints live on the PDP route (where the widget actually mounts)
 * rather than in the sitewide head where they'd compete with the
 * cdn.shopify.com preconnect for connection slots and risk slowing
 * the Shopify CDN warm-up that drives the hero image LCP.
 */
export default async function ProductHandleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle).catch(() => null);
  const ld = product ? getProductJsonLd(product) : [];

  return (
    <>
      <link rel="preconnect" href="https://cdnwidget.judge.me" crossOrigin="" />
      <link rel="dns-prefetch" href="https://cdnwidget.judge.me" />
      <link rel="preconnect" href="https://api.judge.me" crossOrigin="" />
      <link rel="dns-prefetch" href="https://api.judge.me" />
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
