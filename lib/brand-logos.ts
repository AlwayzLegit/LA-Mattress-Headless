/**
 * Brand logo registry.
 *
 * Keyed by the brand collection handle (the `handle` field on the `Brand`
 * objects returned by `getBrands()` / used by the fallback lists). Every
 * consumer (homepage brand strip, /pages/mattress-brands grid) calls
 * `brandLogo(handle)` and falls back to a text wordmark when it returns
 * `undefined`, so the UI never breaks on a missing asset.
 *
 * Assets are first-party files already on our Shopify CDN. Adding or
 * swapping a brand is a one-line data change here; no component edits.
 *
 * Logos should be transparent-background (SVG preferred, else PNG),
 * trimmed to the mark, and roughly landscape — `width`/`height` are the
 * intrinsic asset dimensions so next/image can reserve correct space.
 */
export type BrandLogo = { src: string; width: number; height: number; alt?: string };

// First-party assets already hosted on our Shopify CDN (cdn.shopify.com
// is preconnected + an allowed next/image remote pattern). `width`/
// `height` are the asset's intrinsic dimensions. The `<BrandLogo>`
// client component still falls back to the text wordmark on any load
// error, so a missing/broken asset never shows a broken image.
//
// Sleep & Beyond is intentionally absent — no logo asset exists in
// Shopify Files (only product photography), so it renders its wordmark.
const CDN = 'https://cdn.shopify.com/s/files/1/0684/1759/files';

const LOGOS: Record<string, BrandLogo> = {
  'tempur-pedic-mattresses':   { src: `${CDN}/tempur_logo.png?v=1734093393`,                                              width: 300,  height: 81 },
  'stearns-foster-mattresses': { src: `${CDN}/sf-logo.jpg?v=1734093354`,                                                  width: 1050, height: 574 },
  'chattam-wells-mattresses':  { src: `${CDN}/chattam_and_wells_logo.png?v=1734093913`,                                    width: 250,  height: 199 },
  'helix-mattresses':          { src: `${CDN}/helix-sleep-logo.svg?v=1772652199`,                                          width: 400,  height: 80 },
  'diamond-mattresses':        { src: `${CDN}/Diamond-Mattress-Logo-be5179e-d3ba-46db-9148-d9c708d8d6d6.png?v=1734093172`, width: 600,  height: 172 },
  'spring-air-mattresses':     { src: `${CDN}/spring_air_logo.png?v=1734093907`,                                           width: 249,  height: 169 },
  'eastman-house-mattresses':  { src: `${CDN}/eastmanhouse_Logo.png?v=1734093102`,                                         width: 572,  height: 193 },
  'harvest-mattresses':        { src: `${CDN}/Harvest_Corporate_Logo_png.png?v=1734092763`,                                width: 400,  height: 176 },
  'englander-mattresses':      { src: `${CDN}/Englander_Logo_RGB_360x_22e6e6b2-7219-4012-babd-471329f296a4.png?v=1734093101`, width: 360, height: 38 },
};

export function brandLogo(handle: string): BrandLogo | undefined {
  return LOGOS[handle];
}

export function hasBrandLogo(handle: string): boolean {
  return handle in LOGOS;
}
