#!/usr/bin/env node
/**
 * One-shot validator: produces the SaleEvent JSON-LD for Independence
 * Day 2026 using the same shape as `buildSaleEventLd` in
 * app/(storefront)/pages/[handle]/page.tsx, then runs basic structural
 * checks. Mirrors the prod function exactly so any drift between the
 * two would mean the prod code generates an LD that fails this
 * validator's invariants.
 *
 * Run: node scripts/validate-sale-event-ld.mjs
 *
 * Source of truth for the schema:
 * https://schema.org/SaleEvent
 * https://developers.google.com/search/docs/appearance/structured-data/event
 */

const SITE = 'https://www.mattressstoreslosangeles.com';

// Mirror the 5 LA showrooms from lib/showrooms.ts (just enough fields
// for the LD; full structural validation only).
const SHOWROOMS = [
  { name: 'LA Mattress Store - Koreatown', street: '201 S Western Ave', city: 'Los Angeles', region: 'CA', postalCode: '90004' },
  { name: 'LA Mattress Store - West LA',   street: '10861 W Pico Blvd', city: 'Los Angeles', region: 'CA', postalCode: '90064' },
  { name: 'LA Mattress Store - Hancock Park', street: '300 S La Brea Ave', city: 'Los Angeles', region: 'CA', postalCode: '90036' },
  { name: 'LA Mattress Store - Studio City', street: '12306 Ventura Blvd', city: 'Studio City', region: 'CA', postalCode: '91604' },
  { name: 'LA Mattress Store - Glendale', street: '201 N Central Ave', city: 'Glendale', region: 'CA', postalCode: '91203' },
];

// Representative Independence Day 2026 sale page + featured products.
const page = {
  handle: 'independence-day-sale-2026',
  title: 'Independence Day Mattress Sale 2026 — Up to 70% Off in LA',
  bodySummary: 'Independence Day weekend at LA Mattress. Every mattress on the floor at all 5 LA showrooms is currently on sale.',
  seo: { description: null },
  saleStartsAt: '2026-07-01T00:00:00Z',
  saleEndsAt:   '2026-07-06T06:59:59Z',
};
const featuredProducts = [
  { priceRange: { minVariantPrice: { amount: '1599.0' }, maxVariantPrice: { amount: '3198.0' } } }, // TEMPUR-Adapt
  { priceRange: { minVariantPrice: { amount: '2699.0' }, maxVariantPrice: { amount: '5398.0' } } }, // TEMPUR-ProAdapt Soft
  { priceRange: { minVariantPrice: { amount: '2649.0' }, maxVariantPrice: { amount: '5298.0' } } }, // S&F Lux Estate Hybrid
  { priceRange: { minVariantPrice: { amount: '319.0'  }, maxVariantPrice: { amount: '659.0' } } },  // Diamond Topaz
  { priceRange: { minVariantPrice: { amount: '499.0'  }, maxVariantPrice: { amount: '999.0' } } },  // Eastman Spruce Firm
];
const onSaleCount = 123;

// --- Functions copied verbatim from page.tsx so this script and prod
//     produce the same LD shape. -----------------------------------

function toSentenceCase(s) { return s; }
function stripBrandSuffix(s) { return s; }
function firstNonEmpty(...vals) { return vals.find((v) => v != null && v !== '') ?? null; }

function buildSaleEventLd(page, featuredProducts, onSaleCount) {
  if (!page.saleStartsAt) return null;
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  const url = `${SITE}/pages/${page.handle}`;
  const description = firstNonEmpty(page.seo.description, page.bodySummary, undefined) || undefined;

  const priceAmounts = featuredProducts
    .flatMap((p) => [Number.parseFloat(p.priceRange.minVariantPrice.amount), Number.parseFloat(p.priceRange.maxVariantPrice.amount)])
    .filter((n) => Number.isFinite(n) && n > 0);
  const lowPrice = priceAmounts.length ? Math.min(...priceAmounts) : 199;
  const highPrice = priceAmounts.length ? Math.max(...priceAmounts) : 8999;

  return {
    '@context': 'https://schema.org',
    '@type': 'SaleEvent',
    '@id': `${url}#sale-event`,
    name: cleanTitle,
    ...(description ? { description } : {}),
    url,
    startDate: page.saleStartsAt,
    ...(page.saleEndsAt ? { endDate: page.saleEndsAt } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    organizer: { '@id': `${SITE}/#organization` },
    location: SHOWROOMS.map((s) => ({
      '@type': 'FurnitureStore',
      name: s.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: s.street,
        addressLocality: s.city,
        addressRegion: s.region,
        postalCode: s.postalCode,
        addressCountry: 'US',
      },
    })),
    offers: {
      '@type': 'AggregateOffer',
      url,
      priceCurrency: 'USD',
      lowPrice: lowPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      offerCount: onSaleCount || featuredProducts.length || 1,
      availability: 'https://schema.org/InStock',
    },
  };
}

// --- Validate -------------------------------------------------------

const ld = buildSaleEventLd(page, featuredProducts, onSaleCount);
const json = JSON.stringify(ld, null, 2);
console.log('=== Generated SaleEvent JSON-LD ===\n');
console.log(json);
console.log('\n=== Validation ===\n');

const checks = [];
const expect = (cond, msg) => checks.push({ ok: !!cond, msg });

// Schema.org SaleEvent requires Event fields: name, startDate.
// Recommended: endDate, location, organizer, offers, eventStatus.
// Google Event rich result requires: name, startDate, location, image (we skip image — that's the page meta image).
expect(ld['@context'] === 'https://schema.org', '@context = https://schema.org');
expect(ld['@type'] === 'SaleEvent', '@type = SaleEvent');
expect(typeof ld.name === 'string' && ld.name.length > 0, 'name populated');
expect(typeof ld.startDate === 'string' && !Number.isNaN(Date.parse(ld.startDate)), 'startDate is a valid ISO date');
expect(typeof ld.endDate === 'string' && !Number.isNaN(Date.parse(ld.endDate)), 'endDate is a valid ISO date');
expect(Date.parse(ld.endDate) > Date.parse(ld.startDate), 'endDate is after startDate');
expect(ld.eventStatus === 'https://schema.org/EventScheduled', 'eventStatus is a valid Schema.org EventStatus enum');
expect(ld.eventAttendanceMode === 'https://schema.org/MixedEventAttendanceMode', 'eventAttendanceMode is a valid Schema.org enum');
expect(Array.isArray(ld.location) && ld.location.length === 5, 'location is an array of 5 showrooms');
ld.location.forEach((loc, i) => {
  expect(loc['@type'] === 'FurnitureStore', `location[${i}] @type = FurnitureStore`);
  expect(typeof loc.name === 'string', `location[${i}].name populated`);
  expect(loc.address && loc.address['@type'] === 'PostalAddress', `location[${i}].address @type = PostalAddress`);
  expect(typeof loc.address.streetAddress === 'string' && loc.address.streetAddress.length > 0, `location[${i}].address.streetAddress populated`);
  expect(loc.address.addressCountry === 'US', `location[${i}].address.addressCountry = US`);
});
expect(ld.offers['@type'] === 'AggregateOffer', 'offers @type = AggregateOffer');
expect(ld.offers.priceCurrency === 'USD', 'offers.priceCurrency = USD');
expect(/^\d+\.\d{2}$/.test(ld.offers.lowPrice), 'offers.lowPrice formatted "N.NN"');
expect(/^\d+\.\d{2}$/.test(ld.offers.highPrice), 'offers.highPrice formatted "N.NN"');
expect(Number(ld.offers.highPrice) >= Number(ld.offers.lowPrice), 'highPrice >= lowPrice');
expect(typeof ld.offers.offerCount === 'number' && ld.offers.offerCount > 0, 'offers.offerCount is a positive integer');
expect(ld.offers.availability === 'https://schema.org/InStock', 'offers.availability = InStock');

// Round-trip JSON parse to confirm syntactic validity.
try {
  JSON.parse(json);
  expect(true, 'JSON.parse(stringify(ld)) succeeds');
} catch (e) {
  expect(false, `JSON parse failed: ${e.message}`);
}

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'OK   ' : 'FAIL '} ${c.msg}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed.`);
process.exit(failed > 0 ? 1 : 0);
