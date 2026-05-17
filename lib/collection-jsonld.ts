/**
 * Collection (PLP) JSON-LD, rendered by app/collections/[handle]/layout.tsx
 * — OUTSIDE the in-page <Suspense fallback={CollectionSkeleton}>
 * fast-path in page.tsx. Same fix class as lib/page-jsonld.ts (#166):
 * inside the suspended subtree React left its hidden streaming-source
 * (#S:0) in the DOM on hard load, duplicating CollectionPage +
 * BreadcrumbList (cowork QA, confirmed on /collections/mattresses).
 *
 * Deliberate change vs the old inline LD: the CollectionPage's
 * `mainEntity` product `ItemList` is DROPPED. It was a filter/sort/
 * pagination-dependent list that only existed inside the suspended
 * fetch; reproducing it here would force the layout to re-fetch the
 * full (ambiguous-under-filters) product list. The ItemList of product
 * links is not a Google rich-result requirement — CollectionPage +
 * BreadcrumbList carry the SEO value — so the layout stays a light
 * metadata-only fetch. Everything else is reproduced verbatim.
 */
import type { getCollectionByHandle } from '@/lib/shopify';
import { firstNonEmpty } from '@/lib/seo';

type Collection = NonNullable<Awaited<ReturnType<typeof getCollectionByHandle>>>;
export type CollectionLd = { key: string; data: unknown };

export function getCollectionJsonLd(collection: Collection): CollectionLd[] {
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.mattressstoreslosangeles.com/' },
      { '@type': 'ListItem', position: 2, name: collection.title, item: `https://www.mattressstoreslosangeles.com/collections/${collection.handle}` },
    ],
  };

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    description: firstNonEmpty(collection.seo.description, collection.description) || undefined,
    url: `https://www.mattressstoreslosangeles.com/collections/${collection.handle}`,
    inLanguage: 'en-US',
  };

  return [
    { key: 'ld-collection', data: collectionLd },
    { key: 'ld-breadcrumb-collection', data: breadcrumbLd },
  ];
}
