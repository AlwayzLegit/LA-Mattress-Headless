/**
 * Code-controlled enrichment for the highest-priority blog articles, keyed
 * by handle. Rendered after the merchant body by ArticleEnrichment in the
 * blog-article template.
 *
 * Why: the 20260603 ideas export flagged the mattress-size guides for thin
 * content, missing "related words", weak internal linking, and high bounce
 * — and the cluster cannibalizes itself (5 Full-size posts, 2 Queen, 2
 * King-vs-Cal-King). The duplicates are 301'd into a canonical (see
 * data/url-inventory/redirects.json); the surviving canonical/standalone
 * posts get this enrichment so the rendered page carries a precise
 * dimensions reference, a size comparison, related-size internal links,
 * and an FAQ — addressing the thin-content / related-words / internal-link
 * / engagement flags WITHOUT editing the merchant article body (the newer
 * blog-article model isn't writable via the current Admin API).
 *
 * All facts are sourced from lib/mattress-sizes-data.ts (MATTRESS_SIZES) —
 * nothing invented. `size` mode features one size + neighbors; `compare`
 * mode puts two sizes side by side.
 */

export type EnrichFaq = { q: string; a: string };

export type ArticleEnrichmentConfig =
  | {
      kind: 'size';
      /** MATTRESS_SIZES name to feature (e.g. "Full"). */
      sizeName: string;
      /** Neighbor size names shown in the comparison table. */
      neighbors: string[];
      heading: string;
      lede: string;
      faq: EnrichFaq[];
    }
  | {
      kind: 'compare';
      /** Two MATTRESS_SIZES names, [left, right]. */
      sizes: [string, string];
      heading: string;
      lede: string;
      faq: EnrichFaq[];
    };

export const ARTICLE_ENRICHMENT: Record<string, ArticleEnrichmentConfig> = {
  // ── Full / Double cluster canonical ──────────────────────────────
  'what-is-the-standard-size-of-a-full-bed': {
    kind: 'size',
    sizeName: 'Full',
    neighbors: ['Twin', 'Queen'],
    heading: 'Full (double) bed size — quick reference',
    lede: 'A full and a double are the same mattress. Here are the exact dimensions and how a full stacks up against the sizes on either side of it.',
    faq: [
      { q: 'What are the dimensions of a full bed?', a: 'A full (also called a double) mattress is 54" × 75" — about 4 ft 6 in × 6 ft 3 in, or 137 × 190.5 cm.' },
      { q: 'Is a full bed the same as a double bed?', a: 'Yes. "Full" and "double" are two names for the identical 54" × 75" mattress; the terms are interchangeable.' },
      { q: 'Is a full big enough for two people?', a: 'A full gives two sleepers about 27" of width each — fine for smaller couples or a solo sleeper who likes room, but most couples prefer a queen (60" × 80") for more shoulder space.' },
      { q: 'What size room does a full bed need?', a: 'A 9 × 10 ft bedroom is the realistic minimum for a full once you allow walk-around space on two or three sides.' },
    ],
  },
  // ── Queen cluster canonical ──────────────────────────────────────
  'queen-mattress-size-guide-inches-feet-how-to-pick-the-perfect-fit': {
    kind: 'size',
    sizeName: 'Queen',
    neighbors: ['Full', 'King'],
    heading: 'Queen mattress size — quick reference',
    lede: 'The most-purchased mattress size in the US, in every dimension format, plus how it compares to a full and a king.',
    faq: [
      { q: 'What are queen mattress dimensions?', a: 'A queen is 60" × 80" — 5 ft × 6 ft 8 in, or 152 × 203 cm.' },
      { q: 'Is a queen big enough for a couple?', a: 'Queen is the most-bought couples size in the US, giving each sleeper about 30" of width. Couples who want more shoulder room step up to a king (76" × 80").' },
      { q: 'Queen vs full — what’s the difference?', a: 'A queen is 6" wider and 5" longer than a full (60" × 80" vs 54" × 75").' },
      { q: 'What’s the smallest room for a queen?', a: 'About 10 × 10 ft — the bed takes 5 × 6.7 ft and you need ~24" of walk-around on three sides.' },
    ],
  },
  // ── Twin standalone ──────────────────────────────────────────────
  'what-is-the-size-of-a-twin-mattress': {
    kind: 'size',
    sizeName: 'Twin',
    neighbors: ['Twin XL', 'Full'],
    heading: 'Twin mattress size — quick reference',
    lede: 'The smallest standard size, in every dimension format, plus how it compares to a twin XL and a full.',
    faq: [
      { q: 'What are twin mattress dimensions?', a: 'A twin is 38" × 75" — about 3 ft 2 in × 6 ft 3 in, or 96.5 × 190.5 cm.' },
      { q: 'Twin vs twin XL — what’s the difference?', a: 'Same 38" width; a twin XL is 5" longer (80" vs 75"). Twin XL suits taller sleepers and most college dorms.' },
      { q: 'Is a twin big enough for an adult?', a: 'Yes for solo sleepers and small rooms. Sleepers over about 5’6" often prefer a twin XL for the extra length.' },
      { q: 'What size room does a twin need?', a: 'A 7 × 10 ft bedroom comfortably fits a twin — it’s the only size that works in a genuinely small room.' },
    ],
  },
  // ── King vs California King comparison canonical ─────────────────
  'king-vs-california-king': {
    kind: 'compare',
    sizes: ['King', 'California King'],
    heading: 'King vs California King — side by side',
    lede: 'Same square footage, different shape. King is wider; California King is longer and narrower.',
    faq: [
      { q: 'What’s the difference between a king and a California king?', a: 'A king is wider (76") but shorter (80"). A California king is narrower (72") but longer (84"). Both need a bedroom of at least 12 × 12 ft.' },
      { q: 'Which is better for tall people?', a: 'California King — its 84" length gives sleepers over 6 ft an extra 4 inches versus a standard king.' },
      { q: 'Do king and California king use the same sheets?', a: 'No. They’re different dimensions, so they take different fitted sheets — California king bedding is its own size.' },
    ],
  },
  // ── Full vs Queen comparison (kept distinct) ─────────────────────
  'full-vs-queen-mattress': {
    kind: 'compare',
    sizes: ['Full', 'Queen'],
    heading: 'Full vs Queen — side by side',
    lede: 'A queen is 6" wider and 5" longer than a full. Here’s how that plays out for sleepers and rooms.',
    faq: [
      { q: 'Full vs queen — which is bigger?', a: 'A queen is bigger: 60" × 80" versus a full’s 54" × 75" — 6" wider and 5" longer.' },
      { q: 'Is a full ok for couples, or do we need a queen?', a: 'A full gives each of two sleepers ~27" of width; a queen gives ~30". Smaller couples manage on a full, but most prefer a queen.' },
      { q: 'Does a queen need a much bigger room than a full?', a: 'A full works in about 9 × 10 ft; a queen wants about 10 × 10 ft — a modest difference.' },
    ],
  },
};

export function getArticleEnrichment(handle: string): ArticleEnrichmentConfig | undefined {
  return ARTICLE_ENRICHMENT[handle];
}
