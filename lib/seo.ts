// Title cap before the root layout adds " · LA Mattress" (14 chars). 56 keeps
// the rendered <title> under ~70 chars total, the typical SEO threshold.
const TITLE_MAX = 56;
const DESCRIPTION_MAX = 160;

export function capTitle(s: string, max = TITLE_MAX): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
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

// Words that must keep their original case after sentenceCase normalization.
// Anything else is lowercased except the first character of the string.
// Order matters when one entry is a substring of another.
const SENTENCE_CASE_KEEPERS = [
  'LA', 'CA', 'USA', 'US', 'NYC',
  // multi-word place / brand / street tokens — written in canonical case
  'West LA', 'Hancock Park', 'Koreatown', 'West Hollywood', 'Beverly Hills', 'Studio City',
  'Pico Blvd', 'La Brea Ave', 'Western Ave', 'Ventura Blvd', 'Brand Blvd', 'Wilshire',
  'Tempur-Pedic', 'Stearns & Foster', 'Chattam & Wells', 'Diamond', 'Helix',
  'Spring Air', 'Eastman House', 'Englander', 'Eclipse', 'Southerland', 'Rize Home',
  'Sealy', 'Serta', 'Simmons', 'Beautyrest', 'Sleep Number',
  'Los Angeles', 'Glendale', 'Sawtelle',
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
