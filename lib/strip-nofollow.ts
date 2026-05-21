/**
 * Pure decision: given an anchor's `href` and `rel` values, return the
 * `rel` string that should be set after stripping any internal-link
 * nofollow / sponsored / ugc tokens.
 *
 * Powers two consumers with the same semantics:
 *   - Server-side: `lib/sanitize.ts::stripInternalLinkNofollow` does
 *     the equivalent transformation on raw HTML via regex for merchant-
 *     authored bodies passed through `dangerouslySetInnerHTML`.
 *   - Client-side: `app/_components/strip-internal-nofollow.tsx` uses
 *     this helper inside a MutationObserver scoped to the Judge.me
 *     widget container, since Judge.me's review widget injects its
 *     own anchors after page load (out of reach of the server pass).
 *
 * "Internal" means: same-site root-relative path (starts with `/`,
 * NOT protocol-relative `//`) OR in-page fragment anchor (starts with
 * `#`). External URLs (`https://...`) pass through unchanged — they're
 * a legitimate use of `nofollow`.
 *
 * Idempotent — applying to an already-stripped value returns it
 * unchanged. Empty / missing inputs return safe defaults.
 *
 * Tokens preserved: `noopener`, `noreferrer`, anything else the
 * caller wants on the anchor. Only the three SEO-noise tokens are
 * dropped.
 */

const NOFOLLOW_TOKEN_RE = /^(?:nofollow|sponsored|ugc)$/i;

export function isInternalHref(href: string | null | undefined): boolean {
  if (typeof href !== 'string' || href.length === 0) return false;
  // Reject protocol-relative `//foo.com/bar` — that's external.
  if (href.startsWith('//')) return false;
  // Internal cases: root-relative path or in-page fragment.
  return href.startsWith('/') || href.startsWith('#');
}

export function stripInternalNofollowFromRel(
  href: string | null | undefined,
  rel: string | null | undefined,
): string {
  if (typeof rel !== 'string' || rel.length === 0) return '';
  if (!isInternalHref(href)) return rel;
  const tokens = rel.split(/\s+/).filter((t) => t.length > 0 && !NOFOLLOW_TOKEN_RE.test(t));
  return tokens.join(' ');
}
