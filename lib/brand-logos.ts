/**
 * Brand logo registry.
 *
 * Keyed by the brand collection handle (the `handle` field on the `Brand`
 * objects returned by `getBrands()` / used by the fallback lists). Every
 * consumer (homepage brand strip, /pages/mattress-brands grid) calls
 * `brandLogo(handle)` and falls back to a text wordmark when it returns
 * `undefined`, so the UI never breaks on a missing asset.
 *
 * The map is intentionally empty until the logo files are sourced and
 * hosted on the Shopify CDN — see BRAND_LOGO_SOURCING_BRIEF.md. Adding a
 * brand is then a one-line data change here; no component edits.
 *
 * Logos should be transparent-background (SVG preferred, else PNG),
 * trimmed to the mark, and roughly landscape — `width`/`height` are the
 * intrinsic asset dimensions so next/image can reserve correct space.
 */
export type BrandLogo = { src: string; width: number; height: number; alt?: string };

const LOGOS: Record<string, BrandLogo> = {
  // 'tempur-pedic-mattresses':   { src: 'https://cdn.shopify.com/s/files/1/0684/1759/files/brand-tempur-pedic.svg', width: 240, height: 64 },
  // 'stearns-foster-mattresses': { src: '…', width: 240, height: 64 },
  // 'sleep-beyond':              { src: '…', width: 240, height: 64 },
};

export function brandLogo(handle: string): BrandLogo | undefined {
  return LOGOS[handle];
}

export function hasBrandLogo(handle: string): boolean {
  return handle in LOGOS;
}
