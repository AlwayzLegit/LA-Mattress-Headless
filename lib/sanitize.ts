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

// Phase 264: strip `<a>` tags whose inner HTML has no visible anchor text
// and no `<img>` (so links wrapping images stay intact). Several merchant
// articles imported from the old Hydrogen site have empty link wrappers
// like `<a href="X"><strong></strong></a>` or `<a href="X"><span class="15"></span></a>`
// — invisible zero-width links that SEMrush flags under "Links with no
// anchor text." Removing them is safe: a link with no visible content
// can't be clicked or read by a screen reader anyway.
const EMPTY_ANCHOR = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
function stripEmptyAnchors(html: string): string {
  return html.replace(EMPTY_ANCHOR, (match, inner: string) => {
    if (/<img\b/i.test(inner)) return match; // image-only link → keep
    const text = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;|\s+/g, '').trim();
    return text === '' ? '' : match;
  });
}

// Phase 271b: rewrite the boilerplate "Read More" anchor text on
// /pages/mattress-warranty links. ~18 product description templates
// share this exact link pattern in their Warranty row:
//   <a href="/pages/mattress-warranty">Read More</a>
// SEMrush flags "Read More" as non-descriptive anchor text. Rather than
// mutating 18 product descriptions individually, we transform the
// anchor text at render time so any product (current or future) with
// this boilerplate gets the descriptive replacement automatically.
//
// Pattern is narrowly scoped to mattress-warranty hrefs so we don't
// accidentally rewrite other "Read More" links that may be legitimate.
const WARRANTY_READ_MORE = /(<a\b[^>]*\bhref="\/pages\/mattress-warranty"[^>]*>)\s*Read More\s*(<\/a>)/gi;

// Phase 281: downgrade merchant-authored <h1> tags to <h2> inside
// rendered Shopify body content. The route templates already emit a
// single <h1> for the page title (article title on /blogs/*/*, product
// title on /products/*, page title on /pages/*) — but the merchant body
// rendered via dangerouslySetInnerHTML often contains its own <h1>
// (Word/Docs paste artifact or merchant convention). Result: two h1s on
// the same page, which SEMrush flags as "Multiple h1 tags" (295 URLs in
// the May 14 audit, mostly blog articles + 22 PDPs).
//
// Downgrading to h2 fixes the SEO issue and gives a sensible visual
// hierarchy (page title h1 → first-level section h2). No content lost.
const MERCHANT_H1_OPEN  = /<h1(\b[^>]*)>/gi;
const MERCHANT_H1_CLOSE = /<\/h1>/gi;

export function sanitizeShopifyHtml(html: string | null | undefined): string {
  if (!html) return '';
  let out = html;
  // Phase 262: rewrite Hydrogen-era CDN URLs FIRST, before the generic
  // host-strip below — otherwise the host gets stripped to a dead
  // root-relative path before we get a chance to redirect to cdn.shopify.com.
  out = out.replace(HYDROGEN_CDN_REWRITE, SHOPIFY_CDN_PREFIX + '$1/');
  for (const re of HOSTS_TO_REWRITE) out = out.replace(re, '');
  out = out.replace(GOOGLE_MAPS_IFRAME, '');
  out = stripEmptyAnchors(out);
  out = out.replace(WARRANTY_READ_MORE, '$1Mattress warranty details$2');
  out = out.replace(MERCHANT_H1_OPEN, '<h2$1>').replace(MERCHANT_H1_CLOSE, '</h2>');
  // Some legacy article bodies were imported with bad encoding and contain
  // U+FFFD (the � replacement char). Drop them — they only ever render as
  // visible glyphs that look broken.
  out = out.replace(/�/g, '');
  return out;
}
