// Site-wide JSON-LD identity blocks. Imported by the root layout so every
// page emits the canonical Organization / LocalBusiness / WebSite triples.
//
// Per-page templates (PDP, PLP, blog, locations index, per-showroom) emit
// their OWN, more specific JSON-LD with a distinct `@id` — Schema.org
// allows multiple of the same @type on a page so long as @id differs.
//
// Phase 268: Organization name + logo now read from `shop.brand` via
// `buildOrganizationLd(shopBrand)`. Hardcoded constants stay as the
// fallback when shop data isn't available (Shopify unconfigured, or
// merchant hasn't filled out Brand assets).

import { SITE_BRAND, SITE_PHONE_SCHEMA, SOCIAL_PROFILES } from './site-config';
import { FALLBACK_SHOWROOMS, type Showroom } from './showrooms';
import type { ShopBrand } from './shopify/queries/shop';

const SITE = 'https://www.mattressstoreslosangeles.com';
const FALLBACK_LOGO = `${SITE}/assets/la-mattress-logo.png`;

export const ORGANIZATION_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: SITE_BRAND,
  url: `${SITE}/`,
  logo: FALLBACK_LOGO,
  telephone: SITE_PHONE_SCHEMA,
  // Phase 277b: include sameAs only when configured — emitting an empty
  // array produces an invalid Organization in some validators.
  ...(SOCIAL_PROFILES.length > 0 ? { sameAs: [...SOCIAL_PROFILES] } : {}),
};

/**
 * Phase 268: build the Organization JSON-LD using Shopify Brand data
 * when available, falling back to the static ORGANIZATION_LD above for
 * any fields the merchant hasn't filled out.
 *
 * Optional `aggregate` enrichment (sitewide rating + count from
 * Judge.me) attaches an aggregateRating to the brand entity. The
 * Organization is emitted on every storefront page via the segment
 * layout, so the brand-level review signal travels with every URL —
 * eligible for the sitewide review snippet in SERP on brand-intent
 * queries like "LA Mattress" or "mattress store los angeles".
 */
export function buildOrganizationLd(
  shop: ShopBrand | null,
  aggregate?: { rating: number; count: number } | null,
) {
  const logo = shop?.brand?.logo?.url ?? FALLBACK_LOGO;
  const name = shop?.name ?? SITE_BRAND;
  // Validate the aggregate before emission. `typeof NaN === 'number'`
  // passes the upstream getShopAggregate guard, so without Number.isFinite
  // here NaN would slip through and emit `"ratingValue": "NaN"` sitewide
  // — invalid JSON-LD that disqualifies the brand snippet. Also clamp
  // rating to the schema.org 1-5 scale we declare via bestRating /
  // worstRating; out-of-range values (rating > 5 from upstream bug)
  // would otherwise produce a validator error.
  const validAggregate =
    aggregate &&
    Number.isFinite(aggregate.rating) &&
    Number.isFinite(aggregate.count) &&
    aggregate.count > 0 &&
    aggregate.rating >= 1 &&
    aggregate.rating <= 5;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name,
    url: `${SITE}/`,
    logo,
    telephone: SITE_PHONE_SCHEMA,
    ...(SOCIAL_PROFILES.length > 0 ? { sameAs: [...SOCIAL_PROFILES] } : {}),
    ...(validAggregate
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            // itemReviewed back-link to the Organization @id makes the
            // "what's being rated" explicit. Without it Google can read
            // the AggregateRating as a self-attached property with
            // ambiguous provenance (the 2019 review-snippet update
            // demoted self-serving Organization ratings); the back-link
            // declares that customer reviews aggregate to the brand
            // entity, which is the truthful semantic.
            itemReviewed: { '@type': 'Organization', '@id': `${SITE}/#organization` },
            ratingValue: aggregate.rating.toFixed(1),
            reviewCount: aggregate.count,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  };
}

/**
 * Build the LocalBusiness JSON-LD using a live showroom list. Pass the
 * array from `await getShowrooms()` to make the sitewide LD reflect the
 * merchant's current Shopify metaobject data (hours / phones / addresses
 * propagate within one ISR cycle). When called without an argument,
 * falls back to the static FALLBACK_SHOWROOMS so render paths that
 * can't easily await (rare) still get a valid LD.
 *
 * Top-level FurnitureStore address uses the Studio City showroom
 * (12306 Ventura Blvd) — Shopify shop.billingAddress, i.e. the
 * canonical corporate address. Each individual showroom is also
 * emitted as a `department` branch so Google sees both the corporate
 * anchor and the 5 branch locations.
 */
export function buildLocalBusinessLd(showrooms: Showroom[] = FALLBACK_SHOWROOMS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    '@id': `${SITE}/#localbusiness`,
    name: SITE_BRAND,
    url: `${SITE}/`,
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
    department: showrooms.map((s) => ({
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
      // Phase 287: reinforce the GBP/Maps entity association from the
      // homepage (highest-authority page) too — each department branch
      // points at its verified Google Business Profile.
      ...(s.gbpUrl ? { sameAs: [s.gbpUrl] } : {}),
    })),
    parentOrganization: { '@id': `${SITE}/#organization` },
  };
}

/**
 * Back-compat constant. Prefer `buildLocalBusinessLd(await getShowrooms())`
 * in new code. Existing imports of `LOCAL_BUSINESS_LD` keep working,
 * but they're stuck on the static fallback and don't reflect merchant
 * edits in Shopify Admin.
 */
export const LOCAL_BUSINESS_LD = buildLocalBusinessLd();

export const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  url: `${SITE}/`,
  name: SITE_BRAND,
  publisher: { '@id': `${SITE}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE}/search?q={query}`,
    'query-input': 'required name=query',
  },
};
