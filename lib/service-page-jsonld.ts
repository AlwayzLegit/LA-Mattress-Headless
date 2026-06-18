/**
 * Domain JSON-LD for the "confidence" service pages (financing, delivery,
 * guarantees, warranty). These render via the ServicePage template but,
 * in getPageJsonLd, fall through to the generic WebPage + BreadcrumbList
 * block — so the financing and delivery URLs carried no schema describing
 * the actual offering. SEMrush 20260616 audit / SEO plan Phase 4.
 *
 * Each node is a schema.org Service (or FinancialProduct for financing,
 * its dedicated subtype) attached to the sitewide Organization via @id —
 * the same #organization node emitted in lib/structured-data.ts and
 * referenced by the showroom `servicesLd` graph, so these read as one
 * connected entity tree rather than orphan blocks. Descriptions reuse the
 * page's own `lede` (lib/service-pages.ts) so the schema can't drift from
 * the visible copy.
 *
 * Kept in a standalone module (no `@/` runtime imports) so it can be
 * unit-tested under Node's type-stripping; lib/page-jsonld.ts imports it.
 */
import { SERVICE_PAGES, type ServicePageHandle } from './service-pages.ts';

const SITE = 'https://www.mattressstoreslosangeles.com';

export function buildServicePageLd(handle: ServicePageHandle): Record<string, unknown> | null {
  const url = `${SITE}/pages/${handle}`;
  const cfg = SERVICE_PAGES[handle];
  const common = {
    '@context': 'https://schema.org',
    '@id': `${url}#service`,
    url,
    provider: { '@id': `${SITE}/#organization` },
    areaServed: { '@type': 'City', name: 'Los Angeles' },
    ...(cfg?.lede ? { description: cfg.lede } : {}),
  };

  switch (handle) {
    case 'mattress-store-financing':
      return {
        ...common,
        // FinancialProduct is schema.org's dedicated Service subtype for a
        // credit/lease offering; annualPercentageRate 0 encodes the 0% APR.
        '@type': 'FinancialProduct',
        name: '0% APR Mattress Financing',
        category: 'Retail financing',
        annualPercentageRate: 0,
        feesAndCommissionsSpecification:
          'No down payment. 0% APR on approved credit through Synchrony; Acima lease-to-own available with no credit needed.',
      };
    case 'mattress-store-delivery':
      return {
        ...common,
        '@type': 'Service',
        name: 'Free White-Glove Mattress Delivery in Los Angeles',
        serviceType: 'White-glove mattress delivery',
      };
    case 'love-your-bed-guarantee':
      return {
        ...common,
        '@type': 'Service',
        name: '120-Night Mattress Comfort Exchange',
        serviceType: 'Comfort exchange',
      };
    case 'lowest-price-guarantee':
      return {
        ...common,
        '@type': 'Service',
        name: 'Lowest Price Guarantee',
        serviceType: 'Price match guarantee',
      };
    case 'warranty':
      return {
        ...common,
        '@type': 'Service',
        name: 'Mattress Warranty Claim Support',
        serviceType: 'Warranty claim assistance',
      };
    // about + mattress-store-contact describe the business, not a distinct
    // service offering — they keep the generic WebPage LD only.
    default:
      return null;
  }
}
