/**
 * CDN cache policy for canonical (param-less) collection PLP responses.
 *
 * Audit perf-isr-07, first step (design note in
 * data/audits/2026-07-deep-audit/REPORT.md). PLPs are `force-dynamic`
 * because sort/filter/pagination live in searchParams, so every cold
 * hit pays a full lambda + Shopify render — the 2026-07-07 and
 * 2026-07-11 Semrush crawls each caught a ~5s first-visitor render
 * (issue 111) and pinned the performance score at 95. The param-less
 * canonical view — the request class crawlers and most organic
 * landings hit — is identical for every anonymous visitor (cart /
 * wishlist / compare are client-side; the route reads no cookies), so
 * it's safe to cache at the CDN:
 *
 *   - `s-maxage=300`: Vercel's edge serves repeat hits for 5 minutes
 *     without invoking the function. Price/stock freshness stays well
 *     inside the ~1h ISR cadence the rest of the site already accepts.
 *   - `stale-while-revalidate=600`: after expiry the edge serves the
 *     stale copy instantly and refreshes in the background — nobody
 *     (crawler included) waits on a cold render again.
 *
 * Query-carrying requests (sort/filter/`after` cursors) return null —
 * they stay fully dynamic. Vercel also refuses to CDN-cache any
 * response that sets cookies, which is the automatic failsafe if a
 * future change adds one.
 *
 * Pure function so the SSR suite can exercise it via the node test
 * loader (relative imports only — see lib/service-pages.ts note).
 */

const CANONICAL_PLP_RE = /^\/collections\/[a-z0-9-]+$/;

export const PLP_CDN_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

/**
 * Returns the Cache-Control value for a canonical PLP request, or
 * null when the request must stay dynamic (query params present,
 * sub-paths, non-collection routes).
 */
export function plpCdnCacheControl(pathname: string, search: string): string | null {
  if (search && search !== '?') return null;
  if (!CANONICAL_PLP_RE.test(pathname)) return null;
  return PLP_CDN_CACHE_CONTROL;
}
