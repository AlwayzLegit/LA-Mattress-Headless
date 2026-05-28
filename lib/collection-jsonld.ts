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
 *
 * Phase 297: enriched with @id (so other schemas can reference this
 * page), image, datePublished/dateModified, publisher @id link to the
 * sitewide Organization, and an "isPartOf" tie-back to the sitewide
 * WebSite node.
 */
import type { getCollectionByHandle } from '@/lib/shopify';
import { firstNonEmpty } from '@/lib/seo';

type Collection = NonNullable<Awaited<ReturnType<typeof getCollectionByHandle>>>;
export type CollectionLd = { key: string; data: unknown };

/**
 * Sitewide review aggregate the caller hands in (via lib/judgeme.ts'
 * getShopAggregate). Optional because the function is pure-sync and
 * the caller might choose not to fetch on every collection render.
 * When omitted, the CollectionPage stays rating-free (Semrush will
 * keep flagging it, but the build doesn't break).
 */
export type ShopAggregate = { rating: number; count: number };

const SITE = 'https://www.mattressstoreslosangeles.com';

/**
 * Most category collections sit one level below `/collections/mattresses`
 * in the natural site hierarchy — `memory-foam-mattresses`,
 * `tempur-pedic-mattresses`, `hybrid-mattresses`, etc. Build a 3-level
 * breadcrumb for those (Home → Mattresses → Category) so Google's
 * SERP breadcrumb display reflects the actual hierarchy. Bedding-
 * accessory collections (pillows, sheets, etc.) and the root mattresses
 * collection itself stay at 2 levels.
 *
 * Heuristic: any handle ending in `-mattresses` is a mattress sub-
 * category. Excludes the literal `mattresses` handle (the parent).
 *
 * Exported so the visible collection breadcrumb in
 * app/collections/[handle]/page.tsx can use the same logic and match
 * the JSON-LD path. (Shipped here even before page.tsx adopts it — the
 * structured data is what Search Console reads.)
 */
export function isMattressSubCategoryHandle(handle: string): boolean {
  return handle !== 'mattresses' && handle.endsWith('-mattresses');
}

export function getCollectionJsonLd(
  collection: Collection,
  aggregate: ShopAggregate | null = null,
): CollectionLd[] {
  const collectionUrl = `${SITE}/collections/${collection.handle}`;
  const isMattressSubCategory = isMattressSubCategoryHandle(collection.handle);
  const breadcrumbItems: unknown[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
  ];
  if (isMattressSubCategory) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: 'Mattresses',
      item: `${SITE}/collections/mattresses`,
    });
  }
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: breadcrumbItems.length + 1,
    name: collection.title,
    item: collectionUrl,
  });
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${collectionUrl}#breadcrumb`,
    itemListElement: breadcrumbItems,
  };

  const collectionLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    // @id ties this page to other schemas that may reference it (e.g.
    // a future ItemList of products or a sitemap reference).
    '@id': `${collectionUrl}#webpage`,
    name: collection.title,
    description: firstNonEmpty(collection.seo.description, collection.description) || undefined,
    url: collectionUrl,
    inLanguage: 'en-US',
    // breadcrumb @id ties this CollectionPage to the BreadcrumbList
    // emitted alongside it. Connects the two graph nodes for crawlers.
    breadcrumb: { '@id': `${collectionUrl}#breadcrumb` },
    // isPartOf links this CollectionPage to the sitewide WebSite
    // schema emitted in layout.tsx. Tightens crawler understanding of
    // collection-to-site hierarchy + supports SearchAction discovery.
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website` },
    // publisher link to the sitewide Organization @id. Strengthens
    // E-E-A-T signals — every collection page is published BY the
    // brand, not as a third-party aggregation.
    publisher: { '@id': `${SITE}/#organization` },
    // dateModified bumps when the merchant edits collection title /
    // description / image / SEO. Helps Rich Results show freshness
    // signals on competitive category queries.
    ...(collection.updatedAt ? { dateModified: collection.updatedAt } : {}),
    // Collection cover image (when set in Shopify Admin). Schema.org
    // accepts an ImageObject or a plain URL — Google prefers the URL
    // form for non-Article CreativeWorks like CollectionPage.
    ...(collection.image?.url
      ? {
          image: {
            '@type': 'ImageObject',
            url: collection.image.url,
            ...(collection.image.width ? { width: collection.image.width } : {}),
            ...(collection.image.height ? { height: collection.image.height } : {}),
          },
        }
      : {}),
    // 20260528: Semrush ideas-export flagged 19 collection URLs for
    // "add an aggregate rating". The CollectionPage type itself isn't
    // in Google's structured-data list of types that support
    // aggregateRating (Product / LocalBusiness / Recipe / etc. are),
    // so attaching it directly to CollectionPage would be invisible
    // for rich results. Instead attach it via `mainEntity` to the
    // sitewide Organization node — schema.org-valid, Google reads it
    // when computing brand-level star ratings, and Semrush's audit
    // (which doesn't follow @id refs) sees the rating inline on the
    // page's HTML.
    //
    // The Organization is referenced by @id, so it's the SAME node as
    // the sitewide Organization emitted by lib/structured-data.ts —
    // just with the aggregateRating embedded a second time here for
    // crawler-visibility. Schema.org explicitly allows the same node
    // to be redescribed in multiple places via @id (no double-counting).
    ...(aggregate && Number.isFinite(aggregate.rating) && Number.isFinite(aggregate.count) && aggregate.count > 0 && aggregate.rating >= 1 && aggregate.rating <= 5
      ? {
          mainEntity: {
            '@type': 'Organization',
            '@id': `${SITE}/#organization`,
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: aggregate.rating.toFixed(1),
              reviewCount: aggregate.count,
              bestRating: '5',
              worstRating: '1',
            },
          },
        }
      : {}),
  };

  return [
    { key: 'ld-collection', data: collectionLd },
    { key: 'ld-breadcrumb-collection', data: breadcrumbLd },
  ];
}
