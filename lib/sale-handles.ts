/**
 * Tiny shared module: which Shopify Page handles are sale pages.
 *
 * Extracted from lib/page-jsonld.ts so the storefront page query
 * (lib/shopify/queries/page.ts) can shorten its cache window for sale
 * pages without pulling in the JSON-LD module (which itself imports
 * Page types and would create a cycle).
 *
 * Single source of truth — the SalePage dispatch in
 * app/(storefront)/pages/[handle]/page.tsx and the JSON-LD builder
 * both read from here.
 */
export const SALE_HANDLE_PATTERNS = [
  /(^|-)sale(-|$)/i,
  /memorial-day/i,
  /labor-day/i,
  /presidents-?day/i,
  /mlk-?day/i,
  /july-?4|4th-of-july|fourth-of-july|independence-day/i,
  /black-friday/i,
  /cyber-monday/i,
  /christmas/i,
  /new-year/i,
  /spring-sale|summer-sale|fall-sale|winter-sale/i,
  /clearance/i,
  /deals?-event/i,
];

export function isSalePage(handle: string): boolean {
  return SALE_HANDLE_PATTERNS.some((p) => p.test(handle));
}
