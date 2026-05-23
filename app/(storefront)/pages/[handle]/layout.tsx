import { getPageByHandle } from '@/lib/shopify';
import { getPageJsonLd } from '@/lib/page-jsonld';
import { isCodedPage, getCodedPageJsonLd } from '@/lib/coded-pages';
import { getShopAggregate } from '@/lib/judgeme';

/**
 * Segment layout for /pages/[handle]. Its only job is to emit the
 * page-specific JSON-LD HERE — in the layout, not inside page.tsx.
 *
 * History: page.tsx used to be wrapped by a route-level loading.tsx
 * Suspense fallback. On hard load the streamed page subtree left
 * React's hidden streaming-source node (<div hidden id="S:0">) in the
 * DOM, duplicating every id-bearing <script> (cowork QA P1-2,
 * template-wide). loading.tsx has since been removed (so SSR HTML
 * matches the client and there's no #S:0), but keeping the JSON-LD in
 * the layout remains the durable choice: layouts re-render per handle
 * on client nav (clears the stale-schema-on-soft-nav leak) and it's
 * structurally immune if a Suspense boundary is ever reintroduced.
 *
 * getPageByHandle is React.cache()-memoized, so this and page.tsx share
 * a single Storefront request per render.
 */
export default async function PageHandleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  let ld;
  if (isCodedPage(handle)) {
    // No Shopify page behind these — JSON-LD comes from lib/coded-pages.
    ld = getCodedPageJsonLd(handle);
  } else {
    // Fetch the shop aggregate alongside the page so showroom /
    // locations-index / neighborhood LocalBusiness LD can carry an
    // aggregateRating. Sitewide reviews come from Judge.me; same hourly-
    // ISR-cached fetch the storefront layout already uses for the
    // Organization LD, so this is effectively a free read.
    const [page, aggregate] = await Promise.all([
      getPageByHandle(handle).catch(() => null),
      getShopAggregate().catch(() => null),
    ]);
    ld = page ? getPageJsonLd(page, aggregate) : [];
  }

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
