import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { searchProducts } from '@/lib/shopify/queries/search';
import { getProductByHandle } from '@/lib/shopify/queries/product';
import { readCart } from '@/app/_actions/cart';
import type { ProductSummary, Money } from '@/lib/shopify/types';

/**
 * Custom tools for the chat assistant — wrappers around our existing
 * Storefront API queries, exposed to Claude via the standard
 * Anthropic tool-use shape.
 *
 * We deliberately did NOT route through Shopify's hosted Storefront MCP
 * (the /api/ucp/mcp endpoint). Reasons:
 *   - Our Storefront queries already return ProductSummary in the shape
 *     PlpCard expects — no transformer required.
 *   - One less network hop per tool call (Claude → us → MCP → Shopify
 *     vs Claude → us → Shopify).
 *   - We can filter / enrich / cache results before they reach the LLM
 *     context window — e.g. cap at 6 products, strip unused fields,
 *     dedupe by handle.
 *   - No need to host a UCP agent-profile URL (the catalog MCP requires
 *     one) — see shopify.dev /apps/build/storefront-mcp for context.
 *   - Same auth surface as the rest of the storefront —
 *     SHOPIFY_STOREFRONT_PUBLIC_TOKEN — so a working storefront
 *     automatically has a working chat.
 *
 * If we ever want to switch to Shopify's hosted MCP (e.g. to expose the
 * chat to non-Anthropic agents), the tool boundaries here are stable
 * enough that the swap is a drop-in.
 */

// ---------------------------------------------------------------------------
// Tool definitions — these are the JSON schemas Claude sees.
// ---------------------------------------------------------------------------

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_products',
    description: [
      "Search the LA Mattress Store catalog for mattresses, adjustable bases,",
      "bedding, and accessories. Use this whenever the shopper asks for a",
      "recommendation, mentions a budget / brand / material / size, or asks",
      "what's available. Returns up to 6 products sorted by best match.",
      "Each result includes the canonical PDP path under /products/<handle>",
      "— surface those as Markdown links so the shopper can tap through.",
      "Do NOT call this for policy/return/financing questions; answer those",
      "directly from your training. Do NOT call it more than twice per turn.",
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            "Free-text product search. Use the shopper's own words plus any inferred filters — e.g. 'cooling hybrid mattress queen', 'tempur-pedic medium', 'adjustable base king'. Keep it short (2-6 keywords).",
        },
        limit: {
          type: 'integer',
          description: 'Max products to return. Default 6, max 12.',
          minimum: 1,
          maximum: 12,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description: [
      "Fetch full details for a single product by its handle (the URL slug",
      "under /products/<handle>). Use only when the shopper asks about a",
      "specific named product AND you don't already have the details from a",
      "prior search_products call in this turn. Returns title, vendor,",
      "price, materials, firmness, height, review rating, and PDP URL.",
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description:
            "The product handle (URL slug). E.g. 'tempur-pedic-tempur-proadapt-medium-hybrid'. Lowercase, hyphen-separated, no leading slash.",
        },
      },
      required: ['handle'],
    },
  },
  {
    name: 'read_cart',
    description: [
      "Inspect the shopper's current cart so you can answer questions like",
      "'what's in my cart?', 'how much is my total?', 'should I add an",
      "adjustable base?', or tailor recommendations against what they",
      "already have. Returns line items (title + variant + quantity + price),",
      "subtotal, total quantity, applied discount codes, and a /cart link",
      "for hand-off when they're ready to checkout. Returns an empty cart",
      "state when the shopper hasn't added anything yet — say so plainly",
      "and offer to recommend something instead of hallucinating items.",
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Compact card shape returned to the client for inline rendering.
// Stripped down from ProductSummary so the chat response payload stays
// small and the LLM tool-result JSON stays focused on what it needs to
// reason about (title + price + brand + rating + url + handle).
// ---------------------------------------------------------------------------

export type ChatProductCard = {
  handle: string;
  url: string;
  title: string;
  vendor: string;
  imageUrl: string | null;
  imageAlt: string | null;
  priceRange: { minPrice: number; maxPrice: number; currency: string };
  rating: number | null;
  ratingCount: number | null;
  firmness: string | null;
  material: string | null;
};

function toCard(p: ProductSummary): ChatProductCard {
  const fmtMoney = (m: Money) => Number.parseFloat(m.amount);
  return {
    handle: p.handle,
    url: `/products/${p.handle}`,
    title: p.title,
    vendor: p.vendor,
    imageUrl: p.featuredImage?.url ?? null,
    imageAlt: p.featuredImage?.altText ?? p.title,
    priceRange: {
      minPrice: fmtMoney(p.priceRange.minVariantPrice),
      maxPrice: fmtMoney(p.priceRange.maxVariantPrice),
      currency: p.priceRange.minVariantPrice.currencyCode,
    },
    rating: p.reviews?.rating ?? null,
    ratingCount: p.reviews?.count ?? null,
    firmness: p.specs?.firmness ?? null,
    material: p.specs?.materialType ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tool dispatch — invoked by /api/chat/route.ts when Claude emits a
// `tool_use` block. Returns the JSON-stringified result to feed back as
// a `tool_result` block, plus the structured card list when relevant
// for the client UI.
// ---------------------------------------------------------------------------

export type ToolExecution = {
  /** Stringified JSON content to send back to Claude as tool_result. */
  llmContent: string;
  /** Optional structured payload streamed to the client for inline UI. */
  uiPayload?: { kind: 'products'; cards: ChatProductCard[] } | { kind: 'product'; card: ChatProductCard };
  /** True when the tool encountered an error — Claude sees the message but treats it as a failure signal. */
  isError?: boolean;
};

export async function executeTool(
  name: string,
  rawInput: unknown,
): Promise<ToolExecution> {
  try {
    switch (name) {
      case 'search_products':
        return await runSearchProducts(rawInput);
      case 'get_product':
        return await runGetProduct(rawInput);
      case 'read_cart':
        return await runReadCart();
      default:
        return {
          llmContent: JSON.stringify({ error: `Unknown tool: ${name}` }),
          isError: true,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      llmContent: JSON.stringify({ error: msg }),
      isError: true,
    };
  }
}

async function runSearchProducts(rawInput: unknown): Promise<ToolExecution> {
  if (typeof rawInput !== 'object' || rawInput === null) {
    return { llmContent: JSON.stringify({ error: 'Invalid input.' }), isError: true };
  }
  const { query, limit } = rawInput as { query?: unknown; limit?: unknown };
  if (typeof query !== 'string' || query.trim().length === 0) {
    return {
      llmContent: JSON.stringify({ error: 'query is required and must be a non-empty string.' }),
      isError: true,
    };
  }
  const first = Math.min(
    Math.max(1, typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 6),
    12,
  );

  const result = await searchProducts(query.trim(), { first });
  const cards = result.products.map(toCard);

  return {
    llmContent: JSON.stringify({
      query: query.trim(),
      total_count: result.totalCount,
      products: cards.map((c) => ({
        handle: c.handle,
        url: c.url,
        title: c.title,
        vendor: c.vendor,
        price_range: c.priceRange,
        rating: c.rating,
        firmness: c.firmness,
        material: c.material,
      })),
    }),
    uiPayload: { kind: 'products', cards },
  };
}

async function runGetProduct(rawInput: unknown): Promise<ToolExecution> {
  if (typeof rawInput !== 'object' || rawInput === null) {
    return { llmContent: JSON.stringify({ error: 'Invalid input.' }), isError: true };
  }
  const { handle } = rawInput as { handle?: unknown };
  if (typeof handle !== 'string' || handle.trim().length === 0) {
    return {
      llmContent: JSON.stringify({ error: 'handle is required.' }),
      isError: true,
    };
  }
  const product = await getProductByHandle(handle.trim());
  if (!product) {
    return {
      llmContent: JSON.stringify({ error: `No product found with handle '${handle}'.` }),
      isError: true,
    };
  }
  // getProductByHandle returns the full Product; pluck the same fields
  // ChatProductCard carries so the tool-result shape matches what the
  // model already learned from search_products.
  const summaryLike: ProductSummary = {
    id: product.id,
    handle: product.handle,
    title: product.title,
    vendor: product.vendor,
    featuredImage: product.featuredImage,
    priceRange: product.priceRange,
    compareAtPriceRange: product.compareAtPriceRange,
    specs: product.specs
      ? {
          firmness: product.specs.firmness,
          heightInches: product.specs.heightInches,
          materialType: product.specs.materialType,
        }
      : undefined,
    reviews: product.reviews,
  };
  const card = toCard(summaryLike);
  return {
    llmContent: JSON.stringify({
      handle: card.handle,
      url: card.url,
      title: card.title,
      vendor: card.vendor,
      price_range: card.priceRange,
      rating: card.rating,
      rating_count: card.ratingCount,
      firmness: card.firmness,
      material: card.material,
      description: product.description?.slice(0, 800) ?? null,
    }),
    uiPayload: { kind: 'product', card },
  };
}

/**
 * Read the shopper's current cart by reading the `cartId` cookie set by
 * our server actions and fetching the cart from Shopify. Returns a
 * compact summary the LLM can reason about — line items, totals, and
 * the canonical /cart hand-off URL.
 *
 * No `uiPayload` — cart state is rendered by the existing CartDrawer
 * component, not by the chat panel. We just give Claude enough context
 * to talk about what's there.
 */
async function runReadCart(): Promise<ToolExecution> {
  const cart = await readCart();
  if (!cart || cart.lines.nodes.length === 0) {
    return {
      llmContent: JSON.stringify({
        is_empty: true,
        cart_url: '/cart',
        message: 'Cart is empty.',
      }),
    };
  }

  const fmt = (m: Money) => Number.parseFloat(m.amount);
  const currency = cart.cost.totalAmount.currencyCode;
  const lines = cart.lines.nodes.map((line) => ({
    title: line.merchandise.product.title,
    variant: line.merchandise.title,
    quantity: line.quantity,
    price: fmt(line.cost.subtotalAmount),
    product_url: `/products/${line.merchandise.product.handle}`,
  }));

  return {
    llmContent: JSON.stringify({
      is_empty: false,
      total_quantity: cart.totalQuantity,
      subtotal: fmt(cart.cost.subtotalAmount),
      total: fmt(cart.cost.totalAmount),
      currency,
      lines,
      discount_codes: cart.discountCodes.filter((d) => d.applicable).map((d) => d.code),
      // Hand-off URLs the assistant can offer the shopper. /cart is the
      // cart-edit page; cart.checkoutUrl jumps straight to the Shopify
      // checkout (skip the cart-review step) when they're ready.
      cart_url: '/cart',
      checkout_url: cart.checkoutUrl,
    }),
  };
}
