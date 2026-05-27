/**
 * Page-specific JSON-LD for the /pages/[handle] route.
 *
 * Rendered by app/pages/[handle]/layout.tsx, not inside page.tsx.
 * page.tsx used to be wrapped by a route-level loading.tsx Suspense
 * fallback; on hard load the streamed page subtree left React's hidden
 * streaming-source node (<div hidden id="S:0">) in the DOM, so the
 * id-bearing <script> tags duplicated (cowork QA P1-2). loading.tsx
 * has since been removed, but the layout remains the durable home for
 * this: it re-renders per handle on client nav (fixes the soft-nav
 * stale-schema leak) and is structurally immune if a Suspense boundary
 * is ever reintroduced.
 *
 * The objects below are reproduced verbatim from the previous inline
 * construction in page.tsx; the dispatch order matches ShopifyPage
 * exactly. Do not "improve" the shapes here — they were tuned across
 * many SEMrush phases.
 */
import type { getPageByHandle } from '@/lib/shopify';
import { SHOWROOMS, findShowroom } from '@/lib/showrooms';
import { findNeighborhood, getNearestShowrooms } from '@/lib/neighborhoods';
import { getShowroomFaq, getCmsPageFaq } from '@/lib/faq-extra';
import { faqJsonLd } from '@/lib/faq';
import { stripBrandSuffix, toSentenceCase, firstNonEmpty } from '@/lib/seo';
import { SITE_PHONE_SCHEMA } from '@/lib/site-config';

type Page = NonNullable<Awaited<ReturnType<typeof getPageByHandle>>>;
export type PageLd = { key: string; data: unknown };

export type ShopAggregate = { rating: number; count: number };

// Same canonical host string the inline LD used in page.tsx.
const SITE = 'https://www.mattressstoreslosangeles.com';

/**
 * Build the aggregateRating fragment for a LocalBusiness JSON-LD block.
 *
 * The reviews are Judge.me's sitewide aggregate — i.e. the brand-chain
 * total — so we attach the SAME aggregate to every LocalBusiness emit
 * (homepage, locations index, individual showrooms, neighborhood pages).
 * This is the same pattern multi-location chains (Starbucks, McDonald's,
 * etc.) use: each branch participates in the brand-level rating, which
 * unlocks the "X stars (N reviews)" snippet on local SERP / Maps for
 * every URL that emits LocalBusiness markup — not just the homepage.
 *
 * itemReviewed back-link is required: without it Google reads the
 * AggregateRating as a self-attached property with ambiguous provenance
 * (the 2019 review-snippet update demoted self-serving LocalBusiness
 * ratings). The back-link declares that customer reviews aggregate to
 * the LocalBusiness entity by its @id.
 *
 * Validation mirrors lib/structured-data.ts buildOrganizationLd —
 * NaN/Infinity rejected (typeof NaN === 'number' would otherwise emit
 * "ratingValue": "NaN", invalid JSON-LD), count > 0 required, rating
 * clamped to the 1-5 range we declare via best/worstRating.
 */
function aggregateRatingFor(
  localBusinessId: string,
  aggregate: ShopAggregate | null | undefined,
): { aggregateRating: Record<string, unknown> } | Record<string, never> {
  if (
    !aggregate ||
    !Number.isFinite(aggregate.rating) ||
    !Number.isFinite(aggregate.count) ||
    aggregate.count <= 0 ||
    aggregate.rating < 1 ||
    aggregate.rating > 5
  ) {
    return {};
  }
  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      itemReviewed: { '@type': 'FurnitureStore', '@id': localBusinessId },
      ratingValue: aggregate.rating.toFixed(1),
      reviewCount: aggregate.count,
      bestRating: '5',
      worstRating: '1',
    },
  };
}

// isSalePage / SALE_HANDLE_PATTERNS now live in lib/sale-handles.ts so
// the storefront page query can import them without pulling this
// module's Page-type dependency. Re-exported here so existing callers
// (page.tsx, this file's getPageJsonLd dispatch) keep working.
export { isSalePage, SALE_HANDLE_PATTERNS } from './sale-handles';
import { isSalePage } from './sale-handles';

function genericPageLd(page: Page): PageLd[] {
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  const url = `${SITE}/pages/${page.handle}`;
  // Schema audit (2026-05): generic CMS pages now link to the sitewide
  // WebSite + Organization nodes via @id (matches the same pattern used
  // by collection-jsonld.ts and the showroom sub-paths). WebPage and
  // BreadcrumbList cross-reference each other via @id so crawlers can
  // tie them together as one graph instead of orphan nodes.
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: cleanTitle, item: url },
    ],
  };
  const description = firstNonEmpty(page.seo.description, page.bodySummary, undefined) || undefined;
  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: cleanTitle,
    url,
    ...(description ? { description } : {}),
    inLanguage: 'en-US',
    // Cross-link to the BreadcrumbList emitted alongside.
    breadcrumb: { '@id': `${url}#breadcrumb` },
    // Sitewide refs by @id — matches collection-jsonld.ts conventions.
    // The WebSite + Organization nodes are emitted by the storefront
    // layout (lib/structured-data.ts).
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website` },
    publisher: { '@id': `${SITE}/#organization` },
    ...(page.createdAt ? { datePublished: page.createdAt } : {}),
    ...(page.updatedAt ? { dateModified: page.updatedAt } : {}),
  };
  const out: PageLd[] = [
    { key: 'ld-page', data: webPageLd },
    { key: 'ld-breadcrumb-page', data: breadcrumbLd },
  ];
  const faqs = getCmsPageFaq(page.handle);
  if (faqs) out.push({ key: 'ld-faq-page', data: faqJsonLd(faqs) });
  return out;
}

export function getPageJsonLd(page: Page, aggregate?: ShopAggregate | null): PageLd[] {
  const url = `${SITE}/pages/${page.handle}`;

  // 1. Showroom
  const showroom = findShowroom(page.handle);
  if (showroom) {
    const localBusinessLd = {
      '@context': 'https://schema.org',
      '@type': 'FurnitureStore',
      '@id': url,
      name: showroom.name,
      url,
      telephone: showroom.phone,
      priceRange: '$$$',
      image: showroom.imageUrl ?? `${SITE}/assets/la-mattress-logo.png`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: showroom.street,
        addressLocality: showroom.city,
        addressRegion: showroom.region,
        postalCode: showroom.postalCode,
        addressCountry: 'US',
      },
      ...(showroom.geo
        ? { geo: { '@type': 'GeoCoordinates', latitude: showroom.geo.latitude, longitude: showroom.geo.longitude } }
        : {}),
      ...(showroom.gbpUrl ? { sameAs: [showroom.gbpUrl] } : {}),
      ...aggregateRatingFor(url, aggregate),
      openingHoursSpecification: showroom.hours.map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek:
          h.day === 'Mon-Fri'
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            : h.day === 'Sat-Sun'
              ? ['Saturday', 'Sunday']
              : h.day === 'Mon-Sat'
                ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                : h.day === 'Sun'
                  ? 'Sunday'
                  : h.day === 'Sat'
                    ? 'Saturday'
                    : h.day,
        opens: h.open,
        closes: h.close,
      })),
      areaServed: ['Los Angeles', showroom.area],
      parentOrganization: { '@id': `${SITE}/#organization` },
    };
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Stores', item: `${SITE}/pages/mattress-store-locations` },
        { '@type': 'ListItem', position: 3, name: showroom.area, item: url },
      ],
    };
    const servicesLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Service',
          name: 'Free White-Glove Mattress Delivery in Los Angeles',
          serviceType: 'Free White-Glove Mattress Delivery',
          provider: { '@id': url },
          areaServed: { '@type': 'City', name: 'Los Angeles' },
          description: 'Free white-glove delivery, setup, and old-mattress haul-away on orders over $499 across Los Angeles. Same-day delivery available when you order by 4pm.',
        },
        {
          '@type': 'Service',
          name: '0% APR Mattress Financing',
          serviceType: '0% APR Mattress Financing',
          provider: { '@id': url },
          areaServed: { '@type': 'City', name: 'Los Angeles' },
          description: '0% APR financing through Synchrony and Acima on approved credit. Terms vary by purchase amount and partner. Apply at checkout or in any showroom.',
        },
        {
          '@type': 'Service',
          name: '120-Night Mattress Comfort Exchange',
          serviceType: '120-Night Comfort Exchange',
          provider: { '@id': url },
          areaServed: { '@type': 'City', name: 'Los Angeles' },
          description: 'Sleep on it for at least 30 nights, then exchange for any other mattress within 120 nights of delivery.',
        },
      ],
    };
    return [
      { key: 'ld-showroom', data: localBusinessLd },
      { key: 'ld-breadcrumb-showroom', data: breadcrumbLd },
      { key: 'ld-faq-showroom', data: faqJsonLd(getShowroomFaq(showroom)) },
      { key: 'ld-services', data: servicesLd },
    ];
  }

  // 2. Locations index
  if (page.handle === 'mattress-store-locations') {
    const localBusinessLd = {
      '@context': 'https://schema.org',
      '@type': 'FurnitureStore',
      '@id': url,
      name: 'LA Mattress Store',
      url,
      telephone: SITE_PHONE_SCHEMA,
      priceRange: '$$$',
      image: `${SITE}/assets/la-mattress-logo.png`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: '12306 Ventura Blvd',
        addressLocality: 'Studio City',
        addressRegion: 'CA',
        postalCode: '91604',
        addressCountry: 'US',
      },
      areaServed: { '@type': 'City', name: 'Los Angeles' },
      ...aggregateRatingFor(url, aggregate),
      department: SHOWROOMS.map((s) => ({
        '@type': 'FurnitureStore',
        name: s.name,
        url: `${SITE}/pages/${s.handle}`,
        telephone: s.phone,
        address: {
          '@type': 'PostalAddress',
          streetAddress: s.street,
          addressLocality: s.city,
          addressRegion: s.region,
          postalCode: s.postalCode,
          addressCountry: 'US',
        },
        ...(s.geo ? { geo: { '@type': 'GeoCoordinates', latitude: s.geo.latitude, longitude: s.geo.longitude } } : {}),
      })),
    };
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Stores', item: url },
      ],
    };
    return [
      { key: 'ld-locations', data: localBusinessLd },
      { key: 'ld-breadcrumb-locations', data: breadcrumbLd },
    ];
  }

  // 3. Sale page (same shape as the generic WebPage LD)
  if (isSalePage(page.handle)) {
    const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: cleanTitle, item: url },
      ],
    };
    const description = firstNonEmpty(page.seo.description, page.bodySummary, undefined) || undefined;
    const webPageLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      name: cleanTitle,
      url,
      ...(description ? { description } : {}),
      inLanguage: 'en-US',
      // @id linkage matches the genericPageLd + collection-jsonld
      // conventions so the sale page joins the same entity graph as
      // the rest of /pages/*.
      breadcrumb: { '@id': `${url}#breadcrumb` },
      isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website` },
      publisher: { '@id': `${SITE}/#organization` },
      ...(page.createdAt ? { datePublished: page.createdAt } : {}),
      ...(page.updatedAt ? { dateModified: page.updatedAt } : {}),
    };
    // BreadcrumbList @id added to match the WebPage's breadcrumb ref.
    const breadcrumbLdWithId = { ...breadcrumbLd, '@id': `${url}#breadcrumb` };
    return [
      { key: 'ld-page', data: webPageLd },
      { key: 'ld-breadcrumb-page', data: breadcrumbLdWithId },
    ];
  }

  // 4. Neighborhood
  const neighborhood = findNeighborhood(page.handle);
  if (neighborhood) {
    const nearest = getNearestShowrooms(neighborhood);
    const primaryShowroom = nearest[0];
    const localBusinessLd = {
      '@context': 'https://schema.org',
      '@type': 'FurnitureStore',
      '@id': url,
      name: `LA Mattress Store — ${neighborhood.name}`,
      url,
      telephone: SITE_PHONE_SCHEMA,
      priceRange: '$$$',
      image: primaryShowroom?.imageUrl ?? `${SITE}/assets/la-mattress-logo.png`,
      // FurnitureStore is a LocalBusiness — Google/SEMrush require a
      // postal `address`. The page targets a neighborhood it has no
      // physical store in, so `areaServed` carries the neighborhood;
      // `address` is the REAL nearest physical showroom (same business,
      // a true address — not a fabricated location). Without this the
      // 8 neighborhood pages emit invalid LocalBusiness markup and get
      // zero rich-result eligibility.
      ...(primaryShowroom
        ? {
            address: {
              '@type': 'PostalAddress',
              streetAddress: primaryShowroom.street,
              addressLocality: primaryShowroom.city,
              addressRegion: primaryShowroom.region,
              postalCode: primaryShowroom.postalCode,
              addressCountry: 'US',
            },
          }
        : {}),
      areaServed: {
        '@type': 'Place',
        name: neighborhood.name,
        ...(neighborhood.geo
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: neighborhood.geo.latitude,
                longitude: neighborhood.geo.longitude,
              },
            }
          : {}),
      },
      ...aggregateRatingFor(url, aggregate),
      department: nearest.map((s) => ({
        '@type': 'FurnitureStore',
        name: s.name,
        url: `${SITE}/pages/${s.handle}`,
        telephone: s.phone,
        address: {
          '@type': 'PostalAddress',
          streetAddress: s.street,
          addressLocality: s.city,
          addressRegion: s.region,
          postalCode: s.postalCode,
          addressCountry: 'US',
        },
        ...(s.geo
          ? { geo: { '@type': 'GeoCoordinates', latitude: s.geo.latitude, longitude: s.geo.longitude } }
          : {}),
      })),
      parentOrganization: { '@id': `${SITE}/#organization` },
    };
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Stores', item: `${SITE}/pages/mattress-store-locations` },
        { '@type': 'ListItem', position: 3, name: neighborhood.name, item: url },
      ],
    };
    return [
      { key: 'ld-neighborhood', data: localBusinessLd },
      { key: 'ld-breadcrumb-neighborhood', data: breadcrumbLd },
    ];
  }

  // 5. Default CMS page
  return genericPageLd(page);
}
