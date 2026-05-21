/**
 * Pure GID helper — Shopify Admin returns IDs as opaque GIDs like
 * `gid://shopify/Product/12345` but the admin.shopify.com deep-link URLs
 * use just the numeric portion (`/products/12345`). This helper extracts
 * that numeric tail.
 *
 * Lives in its own file (not lib/shopify/admin.ts) so the unit test
 * suite can import it without dragging in `server-only`, `@sentry/nextjs`,
 * or the GraphQL fetcher.
 */

export function numericIdFromGid(gid: string): string {
  const m = /\/(\d+)$/.exec(gid);
  return m ? m[1] : gid;
}
