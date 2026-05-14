/**
 * Sanitize Shopify-stored HTML before rendering.
 *
 * Shopify's page editor lets merchants paste hostnames into URLs. When the
 * site was authored, content sometimes references throwaway dev hosts (e.g.
 * `*.trycloudflare.com` quick tunnels) or absolute URLs to the production
 * domain. Both are wrong for our headless storefront:
 *
 *   - Tunnel URLs go offline as soon as the dev session ends → broken images
 *     and dead links on /pages/mattress-store-locations etc.
 *   - Absolute production URLs cause unnecessary cross-origin requests when
 *     the same content can resolve relative to whatever host the page is on.
 *
 * Phase 229: also strips Google Maps `<iframe>` embeds. Merchants pasted
 * map iframes into several showroom page bodies in Shopify, but the
 * showroom template (`app/pages/[handle]/page.tsx`) already renders its
 * own canonical map sourced from geo coordinates in `lib/showrooms.ts`.
 * The result was 2-3 maps side-by-side on Studio City / West LA / La Brea.
 * This pass removes the merchant-pasted iframes so only the canonical
 * map renders. Other iframes (YouTube, Vimeo, future widgets) pass
 * through untouched.
 *
 * This helper rewrites both to root-relative URLs in `href` and `src`
 * attributes. Idempotent. Cheap (single regex pass).
 *
 * The merchant should also clean up the source HTML in Shopify Admin, but
 * this guard prevents a stale leak from breaking the live site.
 */

const HOSTS_TO_REWRITE = [
  // Dev tunnels. Add more as they show up.
  /https?:\/\/[a-z0-9-]+\.trycloudflare\.com/gi,
  // Our own production domain — should be relative when we serve from it.
  /https?:\/\/(?:www\.)?mattressstoreslosangeles\.com/gi,
  // Shopify legacy / mirror hosts that should always be relative paths in
  // our storefront.
  /https?:\/\/la-mattress\.myshopify\.com/gi,
];

// Phase 262: rewrite Hydrogen-era CDN URLs to the canonical Shopify CDN.
// Merchant-authored article bodies (imported from the old Hydrogen site)
// contain `<a href="https://mattressstoreslosangeles.com/cdn/shop/files/…">`
// link wrappers around `<img>` tags. The host-strip pass below would turn
// these into `/cdn/shop/files/…` — a path our headless storefront doesn't
// serve, so it 404s and SEMrush flagged it under "Broken internal images."
// Rewriting to `cdn.shopify.com/s/files/<shop-id>/{files,products}/…`
// points the link at the original full-resolution asset (the merchant's
// intent: click an article image to view it bigger).
//
// Shop ID `1/0684/1759` matches the IDs already used in product
// `featuredImage.url` payloads from the Storefront API.
const HYDROGEN_CDN_REWRITE = /https?:\/\/(?:www\.)?mattressstoreslosangeles\.com\/cdn\/shop\/(files|products)\//gi;
const SHOPIFY_CDN_PREFIX = 'https://cdn.shopify.com/s/files/1/0684/1759/';

// Matches an entire `<iframe …></iframe>` (and self-closing variants) when
// the `src` attribute references Google Maps. Single-line `s` flag covers
// merchant-pasted markup that often spans multiple lines with embedded
// width / height / allowfullscreen attrs.
const GOOGLE_MAPS_IFRAME = /<iframe\b[^>]*\bsrc=["'][^"']*(?:google\.com\/maps|maps\.google\.com)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi;

export function sanitizeShopifyHtml(html: string | null | undefined): string {
  if (!html) return '';
  let out = html;
  // Phase 262: rewrite Hydrogen-era CDN URLs FIRST, before the generic
  // host-strip below — otherwise the host gets stripped to a dead
  // root-relative path before we get a chance to redirect to cdn.shopify.com.
  out = out.replace(HYDROGEN_CDN_REWRITE, SHOPIFY_CDN_PREFIX + '$1/');
  for (const re of HOSTS_TO_REWRITE) out = out.replace(re, '');
  out = out.replace(GOOGLE_MAPS_IFRAME, '');
  // Some legacy article bodies were imported with bad encoding and contain
  // U+FFFD (the � replacement char). Drop them — they only ever render as
  // visible glyphs that look broken.
  out = out.replace(/�/g, '');
  return out;
}
