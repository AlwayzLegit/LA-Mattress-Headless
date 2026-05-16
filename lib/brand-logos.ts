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

// Sourced via the Clearbit Logo API (hotlink-designed, returns the
// brand's logo by domain). Domains verified by search. The `<BrandLogo>`
// client component falls back to the text wordmark on any load error,
// so a missing/!200 logo never shows a broken image. These are interim
// — replace per-brand with official press-kit assets on our CDN when
// available (see BRAND_LOGO_SOURCING_BRIEF.md); no component change.
const CLEARBIT = (domain: string): BrandLogo => ({
  src: `https://logo.clearbit.com/${domain}?size=256`,
  width: 256,
  height: 256,
});

const LOGOS: Record<string, BrandLogo> = {
  'tempur-pedic-mattresses':   CLEARBIT('tempurpedic.com'),
  'stearns-foster-mattresses': CLEARBIT('stearnsandfoster.com'),
  'chattam-wells-mattresses':  CLEARBIT('chattamandwells.com'),
  'helix-mattresses':          CLEARBIT('helixsleep.com'),
  'diamond-mattresses':        CLEARBIT('diamondmattress.com'),
  'spring-air-mattresses':     CLEARBIT('springair.com'),
  'eastman-house-mattresses':  CLEARBIT('eastmanhousemattress.com'),
  'harvest-mattresses':        CLEARBIT('harvestgreenmattress.com'),
  'englander-mattresses':      CLEARBIT('englander.com'),
  'sleep-beyond':              CLEARBIT('sleepandbeyond.com'),
};

export function brandLogo(handle: string): BrandLogo | undefined {
  return LOGOS[handle];
}

export function hasBrandLogo(handle: string): boolean {
  return handle in LOGOS;
}
