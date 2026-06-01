/**
 * Code-side SEO title / description overrides for specific collection
 * handles. Wins over the merchant's `collection.seo.title` / `seo.description`
 * in `app/(storefront)/collections/[handle]/page.tsx` generateMetadata,
 * which itself wins over the `${collection.title} | LA Mattress Store`
 * fallback.
 *
 * Why this exists (Phase 308 SEO audit, Semrush 20260530):
 * specific collection pages had merchant-authored `seo.title` strings
 * that were thoughtful but missed search-query variants Semrush data
 * showed the page was eligible to rank for. Examples surfaced in the
 * audit:
 *   - "tempur-pedic-mattresses" title carried "Tempurpedic" (one word)
 *     and "Tempur-Pedic" (hyphenated) but NOT "Tempur Pedic" (two
 *     words, no hyphen). The two-words-no-hyphen form is a high-volume
 *     search variant Semrush flagged as missing.
 *
 * Why override the merchant: title strings are SEO-critical, the right
 * variant depends on live Semrush keyword data, and asking a merchant
 * to keep that current in Shopify Admin → Edit collection → SEO is a
 * lossy contract. Code is the right home for these decisions, edited
 * via PR when the keyword strategy shifts.
 *
 * When NOT to add an override: if Semrush flags a collection but the
 * merchant's `seo.title` is genuinely good and the missing keyword is
 * a quirk of phrase-tokenization (singular vs plural of an already-
 * present word), don't add an override — over-stuffing the title to
 * cover both forms trips the separate `kw_stuffing_title` flag and
 * reads worse to humans. Pick one form, trust Google's semantic match.
 *
 * Conventions:
 *   - Each title <= 70 chars to stay under SERP truncation
 *   - Each title ends with " | LA Mattress" or " | LA Mattress Store"
 *     (brand suffix)
 *   - Use `·` as the inter-clause separator (consistent with the
 *     homepage hard-coded title in app/(storefront)/page.tsx)
 *   - Description (optional) <= 158 chars
 */
export type CollectionSeoOverride = {
  /** Replaces both `collection.seo.title` and the title fallback. */
  title?: string;
  /** Replaces both `collection.seo.description` and the description fallback. */
  description?: string;
  /**
   * Replaces the visible PLP `<h1>` (which otherwise renders the bare
   * `collection.title`). Use ONLY when the merchant's collection title
   * genuinely omits the page's head ranking term — e.g. the size PLPs
   * are titled "King Mattresses" but rank for "king size mattress", so
   * the H1 drops the "size" the query carries. Keep it human-readable
   * (the rendered H1 appends a period via the template); don't stuff.
   */
  h1?: string;
};

export const COLLECTION_SEO_OVERRIDES: Record<string, CollectionSeoOverride> = {
  // Semrush 20260530: title flagged for missing "tempur pedic"
  // (two words, no hyphen, 502 priority). Live title was
  // "Tempurpedic Mattress (Tempur-Pedic) | Same-Day LA Delivery"
  // — covers "Tempurpedic" (one word) and "Tempur-Pedic" (hyphenated)
  // but missed the no-hyphen search variant. New title covers all
  // three spellings users actually search for.
  'tempur-pedic-mattresses': {
    title: 'Tempur-Pedic Mattress · Tempur Pedic & Tempurpedic | LA Mattress',
  },

  // Semrush 20260601 "Ideas": the size-PLP H1s render the merchant
  // collection title ("King Mattresses", "Queen Mattresses", …) which
  // drops the "size" token the head query carries — flagged
  // `h1_missing_kw` on the highest-volume commercial terms
  // ("king size mattress" 110k/mo, the #25 recovery-plan target). The
  // SEO *titles* are already fine via merchant seo.title; only the
  // visible H1 needs the keyword-complete form. Titles intentionally
  // left untouched here.
  'king-size-mattresses': { h1: 'King Size Mattresses' },
  'queen-size-mattresses': { h1: 'Queen Size Mattresses' },
  'twin-size-mattresses': { h1: 'Twin Size Mattresses' },
  'full-size-mattresses': { h1: 'Full Size Mattresses' },
};

/**
 * Lookup helper. Returns `undefined` for handles without an override
 * so the caller can fall back to the merchant's seo.title / default.
 */
export function getCollectionSeoOverride(handle: string): CollectionSeoOverride | undefined {
  return COLLECTION_SEO_OVERRIDES[handle];
}
