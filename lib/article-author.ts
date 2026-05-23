/**
 * Article-author display normalization.
 *
 * Shopify auto-stamps `article.author` to the API user's display name
 * when articles are created via the Admin REST/GraphQL API. For LA
 * Mattress that meant "Shopify API" appeared as the public author on
 * historical bulk-imported articles — both in OG meta (where SEMrush
 * QA 20260523 P1-9 caught it) and in JSON-LD BlogPosting.author
 * (consumed by Google's E-E-A-T signal for YMYL content).
 *
 * Render-time normalization: any name in `PLACEHOLDER_AUTHOR_NAMES` is
 * treated as missing/anonymous and substituted with the editorial-team
 * label. Real human-author articles pass through untouched. Pairs with
 * a one-time Shopify bulk write (lib/article-author-bulk.ts) that
 * fixes the source data; this helper is the safety net for any path
 * that doesn't go through the bulk-update or for articles imported
 * after the fact.
 */

const PLACEHOLDER_AUTHOR_NAMES: ReadonlySet<string> = new Set([
  'Shopify API',
  'shopify-api',
  'Shopify',
  // Empty strings + whitespace handled by .trim() check below.
]);

export const EDITORIAL_AUTHOR_NAME = 'LA Mattress Editorial';

/**
 * Normalize a Shopify-sourced author into the display name we want to
 * surface in UI / OG meta / JSON-LD. Returns EDITORIAL_AUTHOR_NAME for
 * the placeholder/missing case, the original name otherwise.
 */
export function displayAuthorName(author: { name?: string | null } | null | undefined): string {
  const raw = author?.name?.trim();
  if (!raw || PLACEHOLDER_AUTHOR_NAMES.has(raw)) return EDITORIAL_AUTHOR_NAME;
  return raw;
}

/**
 * Whether the resolved display name represents the editorial team
 * (true) or a real human author (false). Used by article-jsonld.ts to
 * choose between Organization vs Person for BlogPosting.author.
 */
export function isEditorialAuthor(displayName: string): boolean {
  return displayName === EDITORIAL_AUTHOR_NAME;
}
