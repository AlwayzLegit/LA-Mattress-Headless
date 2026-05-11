// Site-wide JSON-LD identity blocks. Imported by the root layout so every
// page emits the canonical Organization / LocalBusiness / WebSite triples.
//
// Per-page templates (PDP, PLP, blog, locations index, per-showroom) emit
// their OWN, more specific JSON-LD with a distinct `@id` — Schema.org
// allows multiple of the same @type on a page so long as @id differs.

import { SITE_BRAND, SITE_PHONE_SCHEMA } from './site-config';
import { SHOWROOMS } from './showrooms';

const SITE = 'https://mattressstoreslosangeles.com';

export const ORGANIZATION_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: SITE_BRAND,
  url: `${SITE}/`,
  logo: `${SITE}/assets/la-mattress-logo.png`,
  telephone: SITE_PHONE_SCHEMA,
};

export const LOCAL_BUSINESS_LD = {
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
    streetAddress: '3550 Wilshire Blvd',
    addressLocality: 'Los Angeles',
    addressRegion: 'CA',
    postalCode: '90010',
    addressCountry: 'US',
  },
  areaServed: { '@type': 'City', name: 'Los Angeles' },
  // Each LA showroom emitted as a department branch. The locations-page
  // template (`/pages/mattress-store-locations`) emits the same shape under
  // its own @id; including it on the homepage too gives crawlers the full
  // multi-location signal from the highest-authority page on the site.
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
  parentOrganization: { '@id': `${SITE}/#organization` },
};

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
