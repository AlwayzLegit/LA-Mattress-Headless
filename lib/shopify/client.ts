/**
 * Shopify Storefront API client.
 *
 * Uses the public Storefront API access token (read-only, scoped to product/
 * collection/page/blog/cart). Per the brief's hard rules: this is the ONLY
 * Shopify API used by the Next.js app — Admin API is forbidden in this
 * codebase.
 *
 * Env vars (set in .env.local + Vercel project env):
 *   SHOPIFY_STORE_DOMAIN              e.g. la-mattress.myshopify.com
 *   SHOPIFY_STOREFRONT_PUBLIC_TOKEN   the public access token
 *   SHOPIFY_API_VERSION               optional, defaults to 2024-10
 */

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const PUBLIC_TOKEN = process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? '2024-10';

export class ShopifyConfigError extends Error {}
export class ShopifyApiError extends Error {
  constructor(message: string, readonly status: number, readonly graphqlErrors?: unknown) {
    super(message);
  }
}

function endpoint(): string {
  if (!STORE_DOMAIN) {
    throw new ShopifyConfigError('SHOPIFY_STORE_DOMAIN is not set');
  }
  if (!PUBLIC_TOKEN) {
    throw new ShopifyConfigError('SHOPIFY_STOREFRONT_PUBLIC_TOKEN is not set');
  }
  return `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;
}

export type StorefrontFetchOptions = {
  /**
   * Next.js fetch cache config. Default is `{ revalidate: 600 }` (10 min) for
   * read queries. Cart mutations should pass `{ cache: 'no-store' }`.
   */
  next?: NextFetchRequestConfig;
  cache?: RequestCache;
  /**
   * Tag for on-demand revalidation via revalidateTag().
   * Routes typically tag with their handle: ['product:tempur-pedic-...'].
   */
  tags?: string[];
};

export async function shopifyFetch<TData = unknown, TVars = Record<string, unknown>>(
  query: string,
  variables?: TVars,
  options: StorefrontFetchOptions = {},
): Promise<TData> {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN!,
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    next: options.next ?? (options.cache ? undefined : { revalidate: 600, tags: options.tags }),
    cache: options.cache,
    // Bound the wait on a hung Storefront response. Without this, a
    // stalled connection holds the SSR render until the platform
    // function timeout; with it, the AbortError propagates through the
    // caller's existing catch paths (PLP/PDP fallbacks, API routes'
    // 503s) within 8s. Matches the Admin API client's timeout.
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ShopifyApiError(`Storefront API HTTP ${res.status}: ${body.slice(0, 200)}`, res.status);
  }

  const json = (await res.json()) as { data?: TData; errors?: unknown };
  // GraphQL allows partial responses: errors[] alongside data{}. Storefront API
  // does this on ACCESS_DENIED for individual fields when the token lacks a
  // scope (e.g. `quantityAvailable` without unauthenticated_read_product_inventory).
  // Surface as a warning and return the partial data — throwing would 404
  // every page over a non-fatal field error.
  if (json.errors && json.data) {
    // Phase 235: NODE_ENV-gated to keep production logs clean. Partial
    // errors are a known steady-state for the public Storefront token
    // (e.g. inventory-scope-denied on `quantityAvailable`) and don't
    // need to land in prod logs every request — they're useful in dev
    // to catch newly-introduced scope-denied queries.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[shopify] partial GraphQL errors:', JSON.stringify(json.errors).slice(0, 500));
    }
    return json.data;
  }
  if (json.errors) {
    throw new ShopifyApiError('Storefront API GraphQL errors', 200, json.errors);
  }
  if (!json.data) {
    throw new ShopifyApiError('Storefront API returned no data', 200);
  }
  return json.data;
}
