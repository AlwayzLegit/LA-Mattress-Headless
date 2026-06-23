import { REDIRECTS } from './redirects-table.ts';

/**
 * True when `/products/<handle>` is a permanent-redirect source — i.e. the
 * product still exists in the Shopify Storefront API (so `productRecommendations`,
 * collection grids, and quiz picks can surface it) but its canonical URL
 * 301-redirects elsewhere (often to the homepage after a discontinuation/merge).
 *
 * Internal links must never point at a redirecting URL (SEMrush "Permanent
 * redirects" notice 214 — ~1,098 PDP-rail links). Callers building
 * ProductSummary lists for any internal-link surface filter these out so the
 * rail links straight to live 200 URLs. Trailing-slash-free, matching the
 * keys packed into REDIRECTS.
 *
 * Lives here (not in redirects-table.ts) because that file is regenerated
 * wholesale by scripts/build-redirects-table.mjs — hand-written helpers
 * there get clobbered on the next sync. This module only consumes the
 * generated REDIRECTS map.
 */
export function isRedirectedProductHandle(handle: string): boolean {
  if (!handle) return false;
  return REDIRECTS.has(`/products/${handle}`);
}
