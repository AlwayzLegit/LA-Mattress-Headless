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

/**
 * Decide whether `href` is internal. With a `siteOrigin` argument, an
 * absolute URL whose origin matches is ALSO internal — needed because
 * the Judge.me widget injects same-site links in absolute form (e.g.
 * `https://mattressstoreslosangeles.com/products/X`), not as root-
 * relative paths. The 2026-05-25 SEMrush drill-down on the 299
 * "Nofollow attributes in internal links" flag showed every entry was
 * a PDP linking to itself via the absolute self-URL — those slipped
 * past the original `/` + `#` prefix check.
 *
 * Without `siteOrigin` (server callers), only `/path` / `#frag` count
 * as internal — preserves merchant-HTML semantics where absolute
 * external URLs to other domains stay nofollowed.
 */
export function isInternalHref(
  href: string | null | undefined,
  siteOrigin?: string | null,
): boolean {
  if (typeof href !== 'string' || href.length === 0) return false;
  // Reject protocol-relative `//foo.com/bar` — that's external.
  if (href.startsWith('//')) return false;
  // Internal cases: root-relative path or in-page fragment.
  if (href.startsWith('/') || href.startsWith('#')) return true;
  // Absolute URL matching the current site origin — also internal.
  // Bare prefix match (rather than `new URL().origin === siteOrigin`)
  // keeps this pure / SSR-safe, and the trailing-`/` boundary check
  // prevents `https://mattressstoreslosangeles.com` from matching
  // `https://mattressstoreslosangeles.com.evil.com`.
  if (typeof siteOrigin === 'string' && siteOrigin.length > 0) {
    if (href === siteOrigin) return true;
    if (href.startsWith(siteOrigin + '/')) return true;
    if (href.startsWith(siteOrigin + '?')) return true;
    if (href.startsWith(siteOrigin + '#')) return true;
  }
  return false;
}

export function stripInternalNofollowFromRel(
  href: string | null | undefined,
  rel: string | null | undefined,
  siteOrigin?: string | null,
): string {
  if (typeof rel !== 'string' || rel.length === 0) return '';
  if (!isInternalHref(href, siteOrigin)) return rel;
  const tokens = rel.split(/\s+/).filter((t) => t.length > 0 && !NOFOLLOW_TOKEN_RE.test(t));
  return tokens.join(' ');
}
