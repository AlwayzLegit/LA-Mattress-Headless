/**
 * SaleEvent + AggregateOffer JSON-LD builder for the SalePage template.
 *
 * Extracted from app/(storefront)/pages/[handle]/page.tsx so the LD
 * shape is unit-testable (tests/ssr/lib-sale-event-ld.test.mjs) and
 * the page handler stays focused on rendering. Single source of truth
 * for the Schema.org SaleEvent the page emits.
 *
 * Why a function, not a constant: the LD's `offers.lowPrice` /
 * `offers.highPrice` / `offers.offerCount` come from the page-level
 * resolution of `featuredProducts` + `onSaleCount`, which only the
 * SalePage handler has (the layout-level JSON-LD builder in
 * lib/page-jsonld.ts has neither). Keeping the builder here lets the
 * page handler just pass in what it already loaded.
 *
 * Schema notes:
 *   - eventStatus is fixed to `EventScheduled`. Schema.org's EventStatus
 *     enum has no "completed" value (Cancelled / MovedOnline / Postponed
 *     / Rescheduled / Scheduled). Google's structured-data guidelines
 *     signal a past event by `endDate < now`, not via a status change.
 *     `EventPostponed` would semantically mean "delayed", which is
 *     worse than relying on the timestamp.
 *   - eventAttendanceMode is `Mixed` because shoppers can buy in any of
 *     the 5 showrooms OR online; pure online-only or pure offline-only
 *     would misrepresent the sale.
 *   - `location[]` carries all 5 LA showrooms so a sale-event rich
 *     result chains to local-business markup for every store.
 */
import type { ProductSummary, Page } from './shopify';
import { firstNonEmpty, stripBrandSuffix, toSentenceCase } from './seo.ts';
import { SHOWROOMS } from './showrooms.ts';

const SITE = 'https://www.mattressstoreslosangeles.com';

export function buildSaleEventLd(
  page: Pick<Page, 'handle' | 'title' | 'bodySummary' | 'seo' | 'saleStartsAt' | 'saleEndsAt'>,
  featuredProducts: Pick<ProductSummary, 'priceRange'>[],
  onSaleCount: number,
): Record<string, unknown> | null {
  if (!page.saleStartsAt) return null;
  const cleanTitle = toSentenceCase(stripBrandSuffix(page.title));
  const url = `${SITE}/pages/${page.handle}`;
  const description = firstNonEmpty(page.seo.description, page.bodySummary, undefined) || undefined;

  // Aggregate price range across the curated/on-sale featured products.
  // Falls back to a wide store-wide range when featuredProducts is empty
  // (no curated collection yet) so the schema still validates.
  const priceAmounts = featuredProducts
    .flatMap((p) => [
      Number.parseFloat(p.priceRange.minVariantPrice.amount),
      Number.parseFloat(p.priceRange.maxVariantPrice.amount),
    ])
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
