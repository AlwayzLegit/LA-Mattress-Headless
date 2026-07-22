// Title cap.
//
// Originally 56, sized to keep the rendered <title> under ~70 chars
// total once the root layout appended " · LA Mattress Store" (~20 chars).
//
// Phase 281 switched detail routes (PDP, PLP, blog, article, CMS) to
// `title: { absolute: title }` which bypasses that layout template —
// the seo.title is now the literal rendered <title>. With the 14-20
// chars of brand suffix gone, the 56 cap was tight enough to truncate
// long product titles like "Diamond Dreamstage 2.0 Collection Clarity
// Medium Cool Copper Gel Memory Foam 13" Mattress" at the same
// position across sibling variants, producing duplicate truncated
// titles ("Diamond Dreamstage 2.0…" for both Medium and Plush
// variants). The May 15 SEMrush re-audit flagged 41 products for
// "Duplicate title tag" because of this.
//
// Phase 289 (this file) raises the cap to 70. Google's SERP display
// truncates at ~580 pixels (typically 55-65 chars depending on letter
// width), but the full title is indexed for ranking up to ~100 chars.
// 70 chars is a balance: most variant differentiators sit at chars
// 40-50, comfortably under 70 even for the longest catalog titles,
// while still being short enough that most titles render fully in
// SERP without "..." truncation.
//
// If you change this, also update the hardcoded threshold in
// app/products/[handle]/page.tsx's titleFallback length check.
const TITLE_MAX = 70;
const DESCRIPTION_MAX = 160;

// Trailing brand suffix as appended by the metadata generators:
// " | LA Mattress", " — LA Mattress Store", " · LA Mattress Store", etc.
// Matches a leading-space separator (pipe / en-dash / em-dash / hyphen /
// middle dot) + "LA Mattress" + optional " Store".
//
// The middle dot matters: the PDP generator appends "· LA Mattress
// Store", and without it here capTitle truncated INTO the suffix —
// 25 of 218 live PDP titles rendered as "… · LA Mattres…" in SERPs,
// the exact failure Phase 292 was built to prevent (audit seo-tech-02).
const BRAND_SUFFIX_RE = /\s[·|–—-]\s*LA\s+Mattress(?:\s+Store)?\s*$/i;

/**
 * Cap a rendered <title> at `max` chars.
 *
 * Phase 292 (cowork MEDIUM#8): when the string overflows and the
 * overflow is (partly) caused by a trailing " | LA Mattress" brand
 * suffix, drop the WHOLE suffix instead of truncating into it. A
 * half-rendered "… | LA Mattr…" looks like a broken render in SERPs.
 * After dropping the suffix, if the base still overflows, truncate the
 * base cleanly (no mangled suffix re-appended). Titles with no
 * recognizable brand suffix keep the original truncate-with-ellipsis
 * behavior.
 */
export function capTitle(s: string, max = TITLE_MAX): string {
  if (s.length <= max) return s;
  const base = s.replace(BRAND_SUFFIX_RE, '');
  if (base !== s && base.length <= max) return base;
  const trimmable = base !== s ? base : s;
  return `${trimmable.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Compose the homepage / site-default <title> from the Shopify Brand
 * slogan without doubling the brand.
 *
 * Phase 292 (cowork LOW#12): the merchant set the Shopify Brand slogan
 * to "LA Mattress | Shop Sales on Best Mattresses & Bedroom Furniture"
 * — already brand-led. The old `${siteName} — ${slogan}` composition
 * then produced "LA Mattress Store — LA Mattress | Shop Sales …" with
 * the brand stated twice before the pipe. When the slogan already
 * references the brand, use it verbatim; otherwise compose
 * "<brand> — <slogan>" (the intended behavior for short taglines like
 * "Sleep, engineered in Los Angeles.").
 */
export function composeBrandTitle(
  siteName: string,
  slogan: string | null | undefined,
  fallback: string,
): string {
  const s = slogan?.trim();
  if (!s) return fallback;
  const brandLed = /^la\s+mattress\b/i.test(s) || s.toLowerCase().includes(siteName.toLowerCase());
  return brandLed ? s : `${siteName} — ${s}`;
}

export function truncDescription(s: string, max = DESCRIPTION_MAX): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 3).trimEnd()}...`;
}

// Pick the first non-empty string from a list. Use this when chaining
// fallbacks for SEO copy where Shopify SEO fields can be `''` (not just null).
export function firstNonEmpty(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return '';
}

// Merchant CMS titles often carry a brand suffix (" | LA Mattress",
// " - Los Angeles") that's fine in <title> but reads as junk in an H1.
// Strip everything from the first pipe / em-dash separator onwards.
export function stripBrandSuffix(s: string): string {
  return s.split(/\s+[|–—]\s+/)[0].trim();
}

// SEMrush flags "Duplicate content in h1 and title" when the rendered
// <title> collapses (case-insensitively) to the on-page <h1>. Detail
// routes derive both from the same Shopify title, so a merchant-set
// seo.title equal to the headline — or the brand-stripped fallback —
// yields title == h1 (Phase 289 only suffixed the empty-seo.title
// path; the 20260518 re-crawl still flagged 151 articles where the
// merchant DID set seo.title to the headline).
//
// When the title collapses to the H1, append the keyword-bearing brand
// suffix so <title> stays distinct AND descriptive (a bare brand append
// still reads as "H1 + boilerplate"); otherwise return it unchanged.
// Result is always capped to TITLE_MAX, with room reserved for the
// suffix in the collapse branch so capTitle can't strip it back off
// and re-introduce the duplicate. stripBrandSuffix on both sides so an
// already-branded title isn't double-branded and the comparison
// ignores any pre-existing suffix. Idempotent.
const TITLE_BRAND_SUFFIX = ' | LA Mattress Store';
function titleDedupeKey(s: string): string {
  return stripBrandSuffix(s).toLowerCase().replace(/\s+/g, ' ').trim();
}
export function ensureTitleDistinctFromH1(title: string, h1: string): string {
  if (titleDedupeKey(title) !== titleDedupeKey(h1)) return capTitle(title);
  return `${capTitle(stripBrandSuffix(title), TITLE_MAX - TITLE_BRAND_SUFFIX.length)}${TITLE_BRAND_SUFFIX}`;
}

// Base string for the PDP fallback <title> ("<base> | LA Mattress
// Store"). Long product names overflow TITLE_MAX once the suffix is
// reserved, and tail-truncation then cuts the trailing firmness word —
// the only token distinguishing Firm/Medium/Soft sibling products, so
// all three collapse to one <title> (Semrush issue 6, duplicate title
// tags: the three 65-char "Brooklyn Bedding Signature Hybrid Cloud
// Pillow Top …" PDPs on the 2026-07-21 crawl). When the suffixed title
// wouldn't survive capping intact and the name leads with the vendor,
// drop the vendor instead — the tail is the unique, keyword-bearing
// part, and the suffix keeps the title brand-bearing.
export function pdpTitleBase(title: string, vendor: string | null | undefined): string {
  const suffixed = `${title}${TITLE_BRAND_SUFFIX}`;
  if (capTitle(suffixed) === suffixed) return title;
  if (vendor && title.startsWith(`${vendor} `)) return title.slice(vendor.length + 1);
  return title;
}

// Words that must keep their original case after sentenceCase normalization.
// Anything else is lowercased except the first character of the string.
// Order matters when one entry is a substring of another.
const SENTENCE_CASE_KEEPERS = [
  'LA', 'CA', 'USA', 'US', 'NYC',
  // brand names — QA 2026-05-22 caught "Welcome to LA mattress store" on
  // /pages/about. Cause: "LA" was a keeper but "LA Mattress" / "LA
  // Mattress Store" were not, so the trailing brand words got
  // sentence-cased. Order matters — list the more-specific multi-word
  // form FIRST so the regex matches it before the shorter "LA" rule
  // would have a chance to grab the standalone token.
  'LA Mattress Store', 'LA Mattress',
  // multi-word place / brand / street tokens — written in canonical case
  'West LA', 'Hancock Park', 'Koreatown', 'West Hollywood', 'Beverly Hills', 'Studio City',
  'Pico Blvd', 'La Brea Ave', 'Western Ave', 'Ventura Blvd', 'Central Ave', 'Brand Blvd', 'Wilshire',
  'Tempur-Pedic', 'Stearns & Foster', 'Chattam & Wells', 'Diamond', 'Helix',
  'Spring Air', 'Eastman House', 'Englander', 'Eclipse', 'Southerland', 'Rize Home',
  'Sealy', 'Serta', 'Simmons', 'Beautyrest', 'Sleep Number',
  'Los Angeles', 'Glendale', 'Sawtelle',
  // Holidays / sale events — Memorial Day H1 was rendering as "Memorial
  // day mattress sale 2026" because only "Memorial" got capitalized
  // (as the first letter of the string); "Day" got lowercased. Same
  // fix pattern as the brand keepers.
  'Memorial Day', 'Labor Day', 'Presidents Day', 'Independence Day',
  'Black Friday', 'Cyber Monday', 'New Year', "New Year's",
];

/**
 * Normalize a Title Case heading to sentence case while preserving proper
 * nouns and brand names. Used on H1s where Shopify CMS titles are
 * SEO-tuned in Title Case but read better as sentence case in the UI.
 *
 * The original Shopify title is still used for <title>, JSON-LD, and other
 * SEO-facing surfaces — this transform is presentation-only.
 */
export function toSentenceCase(s: string): string {
  if (!s) return s;
  // Lowercase everything first.
  let out = s.toLowerCase();
  // Re-capitalize known proper nouns / acronyms.
  for (const keeper of SENTENCE_CASE_KEEPERS) {
    const re = new RegExp(`\\b${keeper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, keeper);
  }
  // Capitalize the first letter of the string.
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}
