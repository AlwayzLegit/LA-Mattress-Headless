import { getCollectionByHandle } from '@/lib/shopify';
import { getCollectionJsonLd } from '@/lib/collection-jsonld';
import { categoryFaqFor } from '@/lib/plp-content';
import { faqJsonLd } from '@/lib/faq';
import { getShopAggregate } from '@/lib/judgeme';

/**
 * Segment layout for /collections/[handle]. Emits the PLP JSON-LD HERE
 * — OUTSIDE page.tsx's in-page <Suspense fallback={CollectionSkeleton}>
 * fast-path, so the id-bearing <script>s can't be caught in React's
 * streaming-source (#S:0) leftover and duplicated on hard load (cowork
 * QA; same fix class as #166).
 *
 * Light metadata-only fetch (first:1): the slim CollectionPage LD
 * dropped the product ItemList, so only collection title/handle/seo/
 * description is needed — independent of the page's heavy filtered
 * fetch (different args, so a separate cheap query, not a dup of the
 * grid query). The PLP FAQ schema is derived from `handle` alone
 * (categoryFaqFor) — same source the in-grid PlpContentBlock used.
 */
export default async function CollectionHandleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  // Fan out the two cheap fetches (collection meta + shop aggregate)
  // in parallel — the aggregate adds the sitewide AggregateRating to
  // the CollectionPage JSON-LD's mainEntity (Semrush 20260528 idea-fix
  // for 19 collection URLs). Judge.me responds in ~150-300ms but is
  // already cached at the fetch layer (revalidate: 3600), so the
  // average payload here is just the wait on the cache lookup.
  const [collection, aggregate] = await Promise.all([
    getCollectionByHandle({ handle, first: 1 }).catch(() => null),
    getShopAggregate().catch(() => null),
  ]);

  const ld = collection ? getCollectionJsonLd(collection, aggregate) : [];
  // FAQPage schema for the below-grid PlpContentBlock — handle-derived,
  // emitted here so it isn't trapped in the suspended subtree either.
  ld.push({ key: `ld-plp-faq-${handle}`, data: faqJsonLd(categoryFaqFor(handle)) });

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
