/**
 * Code-side SEO title / description overrides for specific Shopify
 * CMS page handles. Wins over the merchant's `page.seo.title` /
 * `seo.description` in `app/(storefront)/pages/[handle]/page.tsx`
 * generateMetadata, which itself wins over the
 * `${stripBrandSuffix(page.title)} | LA Mattress Store` /
 * page.bodySummary fallbacks.
 *
 * Why this exists (Phase 308 SEO audit, Semrush 20260530): specific
 * CMS pages had merchant-authored SEO strings that missed search-query
 * variants Semrush data showed the page was eligible to rank for, OR
 * had keyword-stuffing patterns the merchant didn't catch. Same
 * pattern as `lib/collection-seo-overrides.ts` — these decisions
 * depend on live Semrush keyword data that changes over time, and
 * code (edited via PR) is the right home for them, not Shopify Admin
 * where the merchant has to remember to keep them current.
 *
 * Conventions:
 *   - Title ≤ 70 chars (SERP truncation)
 *   - Description ≤ 158 chars (SERP truncation)
 *   - Use `·` as inter-clause separator (consistent with the
 *     hard-coded homepage title in app/(storefront)/page.tsx)
 *   - End title with " | LA Mattress" or " | LA Mattress Store"
 */
export type PageSeoOverride = {
  /** Replaces page.seo.title and the title fallback. */
  title?: string;
  /** Replaces page.seo.description, page.bodySummary, and the description fallback. */
  description?: string;
};

export const PAGE_SEO_OVERRIDES: Record<string, PageSeoOverride> = {
  // Single biggest Semrush-priority URL in the audit (21,599 points).
  // Merchant title "Mattress Size Chart: Bed Dimensions Twin to King |
  // LA Mattress" was missing 8 specific keyword variants — in
  // particular dimension-format phrasings like "bed dimensions feet"
  // and "king size measurement mattress". See
  // lib/mattress-sizes-data.ts + app/_components/sections/
  // mattress-sizes-page.tsx for the full content treatment this URL
  // also got. Title-only override here — description stays merchant.
  'mattress-sizes': {
    title: 'Mattress Size Chart · Bed Dimensions in Feet & Inches | LA Mattress',
  },
  // Second-priority code-controlled CMS page (10,398 points). Semrush
  // flagged the live meta description (160 chars, "mattress store"
  // twice + truncated mid-word "top-qua...") for `kw_stuffing_meta`
  // and `low_readability`. Override cleans both: one "Mattress Store"
  // in the brand context, no truncation, lists all 5 showroom areas
  // (semantically-related neighborhood names Semrush data shows the
  // page ranks for). Title stays the merchant's — it's already good.
  'mattress-store-locations': {
    description:
      'Visit any of LA Mattress Store’s 5 Los Angeles showrooms — Koreatown, West LA, La Brea, Studio City, and Glendale. Free same-day delivery, 0% APR financing.',
  },
};

export function getPageSeoOverride(handle: string): PageSeoOverride | undefined {
  return PAGE_SEO_OVERRIDES[handle];
}
