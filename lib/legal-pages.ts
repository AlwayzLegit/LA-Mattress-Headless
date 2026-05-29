/**
 * Per-handle configuration for the LegalPage template — the policy /
 * legal / warranty pages (terms, privacy, returns, the policy hub,
 * recycling fee, and the per-brand limited-warranty pages) that render
 * long merchant-authored CMS bodies inside a clean, readable chrome:
 *
 *   - Breadcrumb
 *   - Hero (eyebrow + h1 + "last updated")
 *   - Body (merchant HTML) + sticky right-rail TOC on desktop, with a
 *     narrower measure and section dividers for long legal text. Any raw
 *     <table> (e.g. the recycling-fee schedule) gets the shared
 *     .cmp-table-scroll card treatment.
 *   - Slim "questions about a policy?" contact footnote
 *
 * Deliberately NO marketing trust strip / CTA — wrong tone for legal
 * pages. Same philosophy as the other page templates: merchant content
 * stays editable in Shopify Admin → Pages; only the chrome lives in
 * code. New legal pages are added by appending an entry here + listing
 * the handle in LEGAL_PAGE_HANDLES — no new component per page.
 */

export type LegalPageConfig = {
  /** Small uppercase label above the H1. */
  eyebrow: string;
};

export const LEGAL_PAGE_HANDLES = [
  'terms-conditions',
  'privacy-policy',
  'returns',
  'policies',
  'mattress-recycling-fee',
  // Per-brand limited-warranty pages. Mostly flat paragraph walls (no
  // headings → no TOC), so the win here is the readable measure +
  // breadcrumb + "last updated" over the full-width DefaultPage wall.
  // The structured ones (e.g. harvest) also get section dividers + TOC.
  'tempur-pedic-warranty',
  '20-year-diamond-mattress-and-foundation-limited-warranty',
  'harvest-mattress-warranty',
  'spring-air-limited-warranty-and-mattress-care-guidelines-ensuring-your-sleep-experience',
  'guidelines-stearns-foster-mattress-limited-warranty-information',
  'chattam-wells-10-year-non-prorated-limited-warranty-information',
] as const;

export type LegalPageHandle = (typeof LEGAL_PAGE_HANDLES)[number];

export function isLegalPage(handle: string): handle is LegalPageHandle {
  return (LEGAL_PAGE_HANDLES as readonly string[]).includes(handle);
}

export const LEGAL_PAGES: Record<LegalPageHandle, LegalPageConfig> = {
  'terms-conditions': { eyebrow: 'Legal' },
  'privacy-policy': { eyebrow: 'Legal' },
  returns: { eyebrow: 'Policies · Returns & warranty' },
  policies: { eyebrow: 'Policies' },
  'mattress-recycling-fee': { eyebrow: 'Policies · Recycling fee' },
  'tempur-pedic-warranty': { eyebrow: 'Warranty · Tempur-Pedic' },
  '20-year-diamond-mattress-and-foundation-limited-warranty': { eyebrow: 'Warranty · Diamond' },
  'harvest-mattress-warranty': { eyebrow: 'Warranty · Harvest' },
  'spring-air-limited-warranty-and-mattress-care-guidelines-ensuring-your-sleep-experience': {
    eyebrow: 'Warranty · Spring Air',
  },
  'guidelines-stearns-foster-mattress-limited-warranty-information': {
    eyebrow: 'Warranty · Stearns & Foster',
  },
  'chattam-wells-10-year-non-prorated-limited-warranty-information': {
    eyebrow: 'Warranty · Chattam & Wells',
  },
};
