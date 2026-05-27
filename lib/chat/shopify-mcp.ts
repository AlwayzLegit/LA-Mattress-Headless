import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import type { ChatProductCard } from './types';
import {
  ucpProductToCard,
  extractProductsArray,
  extractSingleProduct,
} from './ucp-mapper';

// Re-export the pure mapper from a server-only module too so route
// handlers can keep their imports tidy (one module per concern).
export { ucpProductToCard } from './ucp-mapper';

/**
 * Shopify hosted Storefront MCP client.
 *
 * Phase ~300: drop-in replacement for `lib/chat/tools.ts` that proxies
 * the chat assistant's tool calls through Shopify's two hosted MCP
 * endpoints instead of calling our own Storefront wrappers. Industry-
 * standard architecture per `shopify.dev/docs/apps/build/storefront-mcp`
 * — same protocol that Shopify Magic, Shop App AI, and any other
 * MCP-compatible client uses.
 *
 * Two endpoints per store (no auth required):
 *
 *   - `https://{shop}/api/ucp/mcp` — UCP catalog tools
 *       (`search_catalog`, `lookup_catalog`, `get_product`).
 *       Requires `meta.ucp-agent.profile` URL in every request.
 *   - `https://{shop}/api/mcp` — standard tools
 *       (`get_cart`, `update_cart`, `search_shop_policies_and_faqs`).
 *       The `search_shop_policies_and_faqs` tool pulls answers from
 *       the merchant's Knowledge Base app + Shopify Policies, so
 *       merchant edits in Shopify Admin propagate to the chat with
 *       no code change.
 *
 * Behind a feature flag (`CHAT_USE_HOSTED_MCP`) so the default chat
 * path stays on the custom in-house tools until we've validated the
 * hosted MCP behaves identically on production. See
 * `app/api/chat/route.ts` for the flag wiring.
 */

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? '';

/**
 * Resolve our public origin so the UCP agent profile URL we pass to
 * Shopify points at a publicly-fetchable address. In production this
 * is `https://www.mattressstoreslosangeles.com`. Falls back to the
 * Vercel-injected `VERCEL_URL` (preview deploys) or localhost
 * (development).
 */
function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function ucpAgentProfileUrl(): string {
  return `${siteOrigin()}/.well-known/ucp/agent-profile`;
}

function ucpCatalogEndpoint(): string {
  if (!STORE_DOMAIN) throw new Error('SHOPIFY_STORE_DOMAIN is not set — chat hosted-MCP path unavailable');
  return `https://${STORE_DOMAIN}/api/ucp/mcp`;
}

function standardMcpEndpoint(): string {
  if (!STORE_DOMAIN) throw new Error('SHOPIFY_STORE_DOMAIN is not set — chat hosted-MCP path unavailable');
  return `https://${STORE_DOMAIN}/api/mcp`;
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 transport for MCP over HTTP
// ---------------------------------------------------------------------------

let nextRpcId = 1;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: { structuredContent?: unknown; content?: unknown };
  error?: { code: number; message: string };
};

/**
 * Send a JSON-RPC `tools/call` to a Shopify hosted MCP endpoint and
 * return the structured result. Throws on transport / RPC errors so
 * the chat tool executor can fall back to a friendly error message.
 */
async function mcpCall(
  endpoint: string,
  toolName: string,
  toolArguments: Record<string, unknown>,
): Promise<unknown> {
  const req: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: nextRpcId++,
    method: 'tools/call',
    params: { name: toolName, arguments: toolArguments },
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    // Short timeout — tool calls are interactive; if Shopify's MCP is
    // slow we'd rather surface an error than block the SSE stream.
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Shopify MCP HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as JsonRpcResponse;
  if (json.error) {
    throw new Error(`Shopify MCP RPC error: ${json.error.message}`);
  }
  return json.result?.structuredContent ?? json.result?.content ?? null;
}

// ---------------------------------------------------------------------------
// Anthropic tool definitions (the chat assistant's view of these tools)
// ---------------------------------------------------------------------------

/**
 * Tool names the chat assistant sees. These match Shopify's hosted
 * MCP tool names exactly so an MCP-native client (Claude Desktop with
 * the Shopify MCP plugin, etc.) could swap in transparently.
 */
export type HostedMcpToolName =
  | 'search_catalog'
  | 'get_product'
  | 'get_cart'
  | 'search_shop_policies_and_faqs';

export const HOSTED_MCP_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_catalog',
    description: [
      "Search the LA Mattress Store catalog for mattresses, adjustable bases, bedding, and accessories.",
      "Use this whenever the shopper asks for a recommendation, mentions a budget / brand / material / size,",
      "or asks what's available. Returns products with title, vendor, price range, and PDP URLs — surface those as Markdown links.",
      "Do NOT call this for policy/return/financing questions — use search_shop_policies_and_faqs instead.",
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Free-text search query, e.g. "cooling hybrid queen", "tempurpedic firm".',
        },
        intent: {
          type: 'string',
          description: 'Optional buyer-signal intent string, e.g. "Customer has lower-back pain and is a side sleeper".',
        },
        min_price_cents: {
          type: 'integer',
          description: 'Optional minimum price in cents (e.g. 50000 for $500).',
        },
        max_price_cents: {
          type: 'integer',
          description: 'Optional maximum price in cents (e.g. 200000 for $2000).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description:
      "Get full product details by handle when the shopper asks about a specific product they've seen. Returns variants, full description, all media, and price range.",
    input_schema: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'The product handle (the slug after /products/), e.g. "tempur-pedic-tempur-proadapt-firm-mattress".',
        },
      },
      required: ['handle'],
    },
  },
  {
    name: 'get_cart',
    description:
      "Read the shopper's current cart contents. Use BEFORE answering questions about cart state (\"what's in my cart\", \"how much is my total\", \"do I have free shipping\").",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_shop_policies_and_faqs',
    description: [
      "Answer questions about LA Mattress Store policies (returns, exchanges, financing, delivery, warranty, showrooms),",
      "FAQs, and brand-voice topics. Sources merchant-edited content from Shopify Admin (policies + Knowledge Base app).",
      "Use this INSTEAD of answering from training when the shopper asks about return windows, delivery fees, financing terms,",
      "showroom hours / addresses, or other merchant-policy questions.",
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The shopper\'s question about policies / FAQs, e.g. "what\'s your return policy?".',
        },
        context: {
          type: 'string',
          description: 'Optional context, e.g. "customer is looking at a $3000 mattress".',
        },
      },
      required: ['query'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor — mirrors lib/chat/tools.ts::executeTool() shape so the
// route handler can swap implementations behind a feature flag.
// ---------------------------------------------------------------------------

export type HostedToolExecution = {
  llmContent: string;
  uiPayload?:
    | { kind: 'products'; cards: ChatProductCard[] }
    | { kind: 'product'; card: ChatProductCard };
  isError?: boolean;
};

async function runSearchCatalog(input: Record<string, unknown>): Promise<HostedToolExecution> {
  const query = typeof input.query === 'string' ? input.query : '';
  const intent = typeof input.intent === 'string' ? input.intent : undefined;
  const minPrice = typeof input.min_price_cents === 'number' ? input.min_price_cents : undefined;
  const maxPrice = typeof input.max_price_cents === 'number' ? input.max_price_cents : undefined;
  const args: Record<string, unknown> = {
    meta: { 'ucp-agent': { profile: ucpAgentProfileUrl() } },
    catalog: {
      query,
      context: { address_country: 'US', language: 'en', currency: 'USD', ...(intent ? { intent } : {}) },
      ...(minPrice != null || maxPrice != null
        ? {
            filters: {
              price: {
                ...(minPrice != null ? { min: minPrice } : {}),
                ...(maxPrice != null ? { max: maxPrice } : {}),
              },
            },
          }
        : {}),
      pagination: { limit: 6 },
    },
  };
  const raw = await mcpCall(ucpCatalogEndpoint(), 'search_catalog', args);
  const products = extractProductsArray(raw);
  const cards = products.map(ucpProductToCard).filter((c): c is ChatProductCard => c !== null);
  return {
    llmContent: JSON.stringify({ count: cards.length, products: cards.map(cardLlmShape) }),
    uiPayload: { kind: 'products', cards },
  };
}

async function runGetProduct(input: Record<string, unknown>): Promise<HostedToolExecution> {
  const handle = typeof input.handle === 'string' ? input.handle : '';
  if (!handle) {
    return { llmContent: JSON.stringify({ error: 'handle required' }), isError: true };
  }
  const args = {
    meta: { 'ucp-agent': { profile: ucpAgentProfileUrl() } },
    catalog: { id: handle, identifier_kind: 'handle' },
  };
  const raw = await mcpCall(ucpCatalogEndpoint(), 'get_product', args);
  const product = extractSingleProduct(raw);
  if (!product) {
    return { llmContent: JSON.stringify({ error: 'not found', handle }), isError: true };
  }
  const card = ucpProductToCard(product);
  if (!card) {
    return { llmContent: JSON.stringify({ error: 'unmappable', handle }), isError: true };
  }
  return {
    llmContent: JSON.stringify(cardLlmShape(card)),
    uiPayload: { kind: 'product', card },
  };
}

async function runGetCart(): Promise<HostedToolExecution> {
  const raw = await mcpCall(standardMcpEndpoint(), 'get_cart', {});
  return { llmContent: JSON.stringify(raw ?? { is_empty: true }) };
}

async function runPoliciesAndFaqs(input: Record<string, unknown>): Promise<HostedToolExecution> {
  const query = typeof input.query === 'string' ? input.query : '';
  const ctx = typeof input.context === 'string' ? input.context : undefined;
  const args: Record<string, unknown> = { query };
  if (ctx) args.context = ctx;
  const raw = await mcpCall(standardMcpEndpoint(), 'search_shop_policies_and_faqs', args);
  return { llmContent: JSON.stringify(raw ?? { answer: null }) };
}

export async function executeHostedTool(
  name: string,
  input: unknown,
): Promise<HostedToolExecution> {
  if (typeof input !== 'object' || input === null) {
    return { llmContent: JSON.stringify({ error: 'invalid input' }), isError: true };
  }
  const args = input as Record<string, unknown>;
  try {
    switch (name) {
      case 'search_catalog':
        return await runSearchCatalog(args);
      case 'get_product':
        return await runGetProduct(args);
      case 'get_cart':
        return await runGetCart();
      case 'search_shop_policies_and_faqs':
        return await runPoliciesAndFaqs(args);
      default:
        return {
          llmContent: JSON.stringify({ error: `Unknown tool: ${name}` }),
          isError: true,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown tool error';
    return { llmContent: JSON.stringify({ error: message }), isError: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compact shape sent back to the LLM in tool_result. Lean — Claude
 * doesn't need every field; the inline-card UI gets the full
 * `ChatProductCard` via the SSE `tool_result` event instead.
 */
function cardLlmShape(card: ChatProductCard) {
  return {
    handle: card.handle,
    title: card.title,
    vendor: card.vendor,
    url: card.url,
    price_from: card.priceRange.minPrice,
    price_to: card.priceRange.maxPrice,
    currency: card.priceRange.currency,
    rating: card.rating,
    rating_count: card.ratingCount,
  };
}
