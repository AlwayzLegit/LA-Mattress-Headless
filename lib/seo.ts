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
