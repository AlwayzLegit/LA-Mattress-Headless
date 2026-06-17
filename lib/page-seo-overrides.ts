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
  /**
   * Replaces the visible <h1> on the DefaultPage CMS template (the
   * `toSentenceCase(stripBrandSuffix(page.title))` fallback). The <title>
   * tag and the H1 are tuned independently — Semrush's `duplicate_h1_title`
   * check wants them distinct — so this lets a page carry a query-aligned
   * H1 without dragging the SERP title along (or vice-versa). Only consumed
   * by the generic DefaultPage; specialized templates (showroom, sale,
   * neighborhood, guide) build their own H1 from structured data.
   */
  h1?: string;
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

  // Semrush 20260612 "Ideas" export (full triage table in
  // data/seo-backfills/onpage-ideas-triage-2026-06-12.json).
  //
  // Flagged for "types of mattresses" (54 priority) — the head query
  // is the of-phrase word order, and the merchant title ("Guide to
  // Mattress Types | Find Your Perfect Mattress") only carried the
  // compound form. Lead with the query phrasing.
  'mattress-types': {
    title: 'Types of Mattresses · Every Mattress Type Compared | LA Mattress',
  },
  // Flagged for "mattress companies" (23) — merchant title ("Shop by
  // Top Brands") never says "mattress" at all, so the page couldn't
  // match either "mattress brands" or "mattress companies".
  brands: {
    title: 'Mattress Brands · Top Mattress Companies We Carry | LA Mattress',
  },
  // Flagged for "bed stores near me" (95) — the near-me intent belongs
  // in the description; the merchant title (Glendale + Central Ave) is
  // already a good local title and stays.
  'mattress-store-in-glendale': {
    description:
      'LA Mattress Store Glendale on Central Ave — the bed and mattress store near you, with every major brand on the floor. Free same-day delivery, 0% APR financing.',
  },
};

export function getPageSeoOverride(handle: string): PageSeoOverride | undefined {
  return PAGE_SEO_OVERRIDES[handle];
}
