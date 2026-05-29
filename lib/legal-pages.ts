/**
 * Per-handle configuration for the LegalPage template — the policy /
 * legal pages (terms, privacy, returns, the policy hub, recycling fee)
 * that render long merchant-authored CMS bodies inside a clean, readable
 * chrome:
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
};
