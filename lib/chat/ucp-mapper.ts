import type { ChatProductCard } from './types';

/**
 * Pure UCP catalog → ChatProductCard mapper.
 *
 * Split from lib/chat/shopify-mcp.ts so unit tests can import the
 * mapper without dragging in `server-only` (which throws at import
 * time in non-Next.js test runners). The MCP client wraps this with
 * the HTTP fetch logic.
 *
 * Spec reference:
 *   https://shopify.dev/docs/agents/catalog/storefront-catalog
 *   The UCP catalog response is documented in the Universal Commerce
 *   Protocol — `price_range.min/max` carry money objects with
 *   `amount` in MINOR currency units (cents) and a `currency` code.
 *   `media[]` contains `{url, alt}` objects in display order.
 */

export type UcpMoney = { amount?: string | number; currency?: string };

export type UcpProduct = {
  id?: string;
  title?: string;
  description?: string;
  vendor?: string;
  url?: string;
  handle?: string;
  price_range?: {
    min?: UcpMoney;
    max?: UcpMoney;
  };
  media?: { url?: string; alt?: string }[];
  // Shopify-extension fields we opportunistically harvest if present.
  rating?: { value?: number; count?: number };
  // Custom metafield slots — some catalogs surface these on the
  // top-level product node. Defensive optional reads.
  firmness?: string;
  material?: string;
};

/**
 * Extract `/products/<handle>` from a product URL. UCP responses
 * include a full URL; our ChatProductCard wants a handle so the
 * client can route to our own PDP without re-parsing.
 */
function handleFromUrl(url: string | undefined, fallback: string | undefined): string {
  if (typeof url === 'string') {
    const m = url.match(/\/products\/([^?#/]+)/);
    if (m) return m[1];
  }
  return fallback ?? 'unknown';
}

function minorToMajor(money: UcpMoney | undefined): number {
  if (!money || money.amount == null) return 0;
  const n = typeof money.amount === 'number' ? money.amount : Number.parseFloat(money.amount);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

/**
 * Map a UCP product node to the `ChatProductCard` shape the chat UI
 * already renders. Fields the UCP spec doesn't carry (Judge.me rating,
 * firmness/material from our own metafields) come back null when
 * absent — the UI handles that case. Returns null when the input
 * doesn't have enough data to produce a renderable card (no parseable
 * handle).
 */
export function ucpProductToCard(product: UcpProduct): ChatProductCard | null {
  const handle = handleFromUrl(product.url, product.handle);
  if (!handle || handle === 'unknown') return null;
  const minPrice = minorToMajor(product.price_range?.min);
  const maxPrice = minorToMajor(product.price_range?.max);
  const firstMedia = Array.isArray(product.media) && product.media.length > 0 ? product.media[0] : null;
  return {
    handle,
    url: `/products/${handle}`,
    title: product.title ?? 'Untitled product',
    vendor: product.vendor ?? '',
    imageUrl: firstMedia?.url ?? null,
    imageAlt: firstMedia?.alt ?? product.title ?? null,
    priceRange: {
      minPrice,
      maxPrice: maxPrice > 0 ? maxPrice : minPrice,
      currency: product.price_range?.min?.currency ?? 'USD',
    },
    rating: product.rating?.value ?? null,
    ratingCount: product.rating?.count ?? null,
    firmness: product.firmness ?? null,
    material: product.material ?? null,
  };
}

/**
 * UCP search_catalog responses wrap products under
 * `result.structuredContent.catalog.products` or similar; the shape
 * varies by spec version. Defensive extraction — accept either a top-
 * level array or a nested `products` array.
 */
export function extractProductsArray(raw: unknown): UcpProduct[] {
  if (Array.isArray(raw)) return raw as UcpProduct[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.products)) return r.products as UcpProduct[];
    if (r.catalog && typeof r.catalog === 'object') {
      const c = r.catalog as Record<string, unknown>;
      if (Array.isArray(c.products)) return c.products as UcpProduct[];
    }
  }
  return [];
}

export function extractSingleProduct(raw: unknown): UcpProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.product && typeof r.product === 'object') return r.product as UcpProduct;
  if (r.catalog && typeof r.catalog === 'object') {
    const c = r.catalog as Record<string, unknown>;
    if (c.product && typeof c.product === 'object') return c.product as UcpProduct;
  }
  if ('title' in r || 'handle' in r) return r as UcpProduct;
  return null;
}
