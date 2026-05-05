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

export function sanitizeShopifyHtml(html: string | null | undefined): string {
  if (!html) return '';
  let out = html;
  for (const re of HOSTS_TO_REWRITE) out = out.replace(re, '');
  return out;
}
