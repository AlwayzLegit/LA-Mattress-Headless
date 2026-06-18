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

  // Semrush 20260601 + 20260603 "Ideas": the size PLPs render the merchant
  // collection title ("King Mattresses", "Queen Mattresses", …) which
  // drops the "size" token the head query carries — flagged both
  // `h1_missing_kw` AND, in the 20260603 export, `title_missing_kw` on
  // the highest-volume commercial terms ("king size mattress" 110k/mo was
  // the single highest-priority idea in that export at 1,247). The merchant
  // seo.title leads with "King Mattress" / "Queen Mattress" etc. and never
  // says "<size> size mattress", so override BOTH the title and the H1
  // with the keyword-complete form (kept human-readable, with the price /
  // locality hook preserved, <70 chars). California King is left alone —
  // its merchant title already carries "California King".
  'king-size-mattresses': {
    title: 'King Size Mattresses · Top Brands from $499 | LA Mattress',
    description:
      'Shop king size mattresses from Tempur-Pedic, Stearns & Foster, Diamond & more — every firmness, from $499. Free white-glove LA delivery + 120-night trial.',
    h1: 'King Size Mattresses',
  },
  'queen-size-mattresses': {
    title: 'Queen Size Mattresses · Top Brands from $319 | LA Mattress',
    // Semrush 20260612: "queen size mattress online" + "queen size bed
    // delivery" flagged. Both belong in the description, not the title.
    description:
      'Shop queen size mattresses online from $319 — Tempur-Pedic, Stearns & Foster, Helix & more. Free same-day white-glove LA delivery + 120-night exchange.',
    h1: 'Queen Size Mattresses',
  },
  'twin-size-mattresses': {
    title: 'Twin Size Mattresses in Los Angeles | LA Mattress Store',
    // Semrush 20260612: "twin mattress nearby" — the "near you" intent
    // lives in the description via the showroom mention.
    description:
      'Twin size mattresses in stock at five LA showrooms near you — kids, bunk beds, and guest rooms. Free same-day Los Angeles delivery + 120-night exchange.',
    h1: 'Twin Size Mattresses',
  },
  'full-size-mattresses': {
    title: 'Full Size Mattresses in Los Angeles | LA Mattress Store',
    h1: 'Full Size Mattresses',
  },
  // Semrush 20260618 Ideas: california-king was the only high-traffic size
  // collection with no merchant SEO AND no code override (running purely on
  // the default-computed title). Flagged for the "cal king" abbreviation +
  // semantic variants the bare "California King Mattresses" title missed.
  // No price in the title — the cal-king floor price isn't verifiable from
  // the committed inventory, and a wrong "from $X" is worse than none.
  'california-king-mattresses': {
    title: 'California King Mattresses · Cal King Beds, Top Brands | LA Mattress',
    description:
      'Shop California King (Cal King) mattresses — Tempur-Pedic, Stearns & Foster, Diamond & more, every firmness. Free white-glove LA delivery + 120-night trial.',
    h1: 'California King Mattresses',
  },

  // New sleeper/body-type commercial collections (gap analysis 20260602):
  // extends the existing use-case cluster (back-pain / side-sleepers /
  // couples) into two high-intent shopper segments the catalog already
  // has products for. Titles lead with the head query, stay <70 chars,
  // and end with the brand suffix.
  'mattresses-for-stomach-sleepers': {
    title: 'Best Mattress for Stomach Sleepers · Firm Support | LA Mattress',
    description:
      'Firmer, supportive mattresses that keep stomach sleepers’ hips from sinking and the lower back neutral. Free white-glove LA delivery + 120-night trial.',
    h1: 'Mattresses for Stomach Sleepers',
  },
  'mattresses-for-heavy-people': {
    title: 'Best Mattress for Heavy People (230+ lb) | LA Mattress',
    description:
      'Durable, supportive mattresses for heavier bodies: reinforced coils, dense foam, strong edge support. Free white-glove LA delivery + 120-night trial.',
    h1: 'Mattresses for Heavy People',
  },

  // Semrush 20260612 "Ideas" export. Each entry covers a flagged
  // keyword variant the live title genuinely missed; flags that were
  // singular/plural tokenization quirks or already covered by the
  // Phase 308 overrides above were skipped per the file's
  // anti-stuffing doctrine (see data/seo-backfills/
  // onpage-ideas-triage-2026-06-12.json for the full keyword → action
  // table).
  //
  // Catalog root: flagged for "beds and mattresses online" /
  // "beds & mattresses" — the fallback title was just
  // "Mattresses | LA Mattress Store" and never said "beds" or
  // "online" anywhere on the highest-level PLP.
  mattresses: {
    title: 'Mattresses · Shop Beds & Mattresses Online | LA Mattress Store',
    description:
      'Shop beds and mattresses online or at five LA showrooms — every size, firmness, and top brand. Free same-day white-glove delivery + 120-night exchange.',
  },
  // Sale PLP: flagged for "beds and mattresses sale", "bed for sale",
  // "best deal on mattresses right now". Also the reassignment target
  // for "queen mattresses on sale near me" (Semrush mapped it to the
  // queen PLP; the sale intent belongs here — the description carries
  // the queen/king mention).
  'on-sale': {
    title: 'Mattress Sale · Beds & Mattresses on Sale | LA Mattress Store',
    description:
      'Today’s best mattress deals — queen, king & every size marked down, plus beds for sale from top brands. Free same-day LA delivery + 120-night exchange.',
    h1: 'Beds & Mattresses on Sale',
  },
  // Flagged for "bedframe" (one word) + "mattress frames near me";
  // also the cannibalization fix for "bed frame stores" (which was
  // ranking via /collections/mattresses) — this title makes the
  // bed-frames PLP the obvious destination. The merchant title
  // ("Bed Frames - Bedding Support") kept neither variant.
  'bed-frames': {
    title: 'Bed Frames & Bedframes · Every Mattress Size | LA Mattress',
    description:
      'Sturdy bed frames and bedframes for twin through California king — platform, panel, and adjustable-ready. Five LA showrooms near you, free same-day delivery.',
    h1: 'Bed Frames',
  },
  // Flagged for "gel memory foam mattress" — the catalog's gel beds ARE
  // gel memory foam, but the merchant title dropped the "memory" token
  // shoppers actually search with.
  'gel-foam-mattresses': {
    title: 'Gel Memory Foam Mattresses · Cool-Sleeping Comfort | LA Mattress',
    h1: 'Gel Memory Foam Mattresses',
  },
  // Flagged for "back supporter mattress spring air" — Back Supporter
  // is Spring Air's flagship line and the catalog carries it, so the
  // title can honestly say so.
  'spring-air-mattresses': {
    title: 'Spring Air Mattresses · Back Supporter Collection | LA Mattress',
  },
  // Flagged for "latex queen mattress" — size-in-brand-PLP variant;
  // covered in the description (sizes enumeration), title untouched.
  'latex-mattresses': {
    description:
      'Natural latex mattresses in every size — twin through queen to California king. Breathable, durable comfort. Free same-day delivery across Los Angeles.',
  },
};

/**
 * Lookup helper. Returns `undefined` for handles without an override
 * so the caller can fall back to the merchant's seo.title / default.
 */
export function getCollectionSeoOverride(handle: string): CollectionSeoOverride | undefined {
  return COLLECTION_SEO_OVERRIDES[handle];
}
