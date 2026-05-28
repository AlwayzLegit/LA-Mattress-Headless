import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import * as Sentry from '@sentry/nextjs';
import type { ChatProductCard } from './types';
import {
  ucpProductToCard,
  extractProductsArray,
  extractSingleProduct,
} from './ucp-mapper';
import { executeTool, type ToolExecution } from './tools';

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
 * Per-attempt timeout for a single Shopify hosted MCP fetch. 12s is
 * generous for an interactive chat call but covers the long tail of
 * Shopify's UCP catalog endpoint on cold paths. Combined with one
 * retry, total worst-case wall time is ~25s — still under the route's
 * 60s Vercel function timeout.
 */
const MCP_FETCH_TIMEOUT_MS = 12_000;

/**
 * One retry on transient failures (timeouts, network errors, 5xx).
 * 4xx responses are NOT retried — they're auth/argument bugs that
 * won't fix themselves.
 */
const MCP_MAX_RETRIES = 1;
const MCP_RETRY_BACKOFF_MS = 500;

function isTransientStatus(status: number): boolean {
  // 408 Request Timeout, 425 Too Early, 429 Too Many Requests, all 5xx.
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Send a JSON-RPC `tools/call` to a Shopify hosted MCP endpoint and
 * return the structured result. Retries once on transient errors
 * (timeout / network / 5xx). Throws on auth/4xx errors or after the
 * retry budget is exhausted so the chat tool executor can fall back
 * to the in-house Storefront tools.
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
  const body = JSON.stringify(req);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MCP_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, MCP_RETRY_BACKOFF_MS));
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(MCP_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(`Shopify MCP HTTP ${res.status}: ${text}`);
        if (!isTransientStatus(res.status) || attempt === MCP_MAX_RETRIES) throw err;
        lastError = err;
        continue;
      }
      const json = (await res.json()) as JsonRpcResponse;
      if (json.error) {
        throw new Error(`Shopify MCP RPC error: ${json.error.message}`);
      }
      return json.result?.structuredContent ?? json.result?.content ?? null;
    } catch (err) {
      lastError = err;
      // AbortError (timeout) and TypeError (network) are both retriable.
      const isAbort = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
      const isNetwork = err instanceof TypeError;
      const isRetriableHttp = err instanceof Error && /Shopify MCP HTTP (408|425|429|5\d\d)/.test(err.message);
      const retriable = isAbort || isNetwork || isRetriableHttp;
      if (!retriable || attempt === MCP_MAX_RETRIES) throw err;
    }
  }
  // Unreachable — the loop either returns, throws, or exits via the
  // retry-exhausted branch above. Re-throw lastError defensively.
  throw lastError instanceof Error ? lastError : new Error('Shopify MCP call failed.');
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
  | 'search_shop_policies_and_faqs'
  | 'compare_products';

export const HOSTED_MCP_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_catalog',
    description: [
      "Search the LA Mattress Store catalog for mattresses, adjustable bases, bedding, and accessories.",
      "Use this whenever the shopper asks for a recommendation, mentions a budget / brand / material / size,",
      "or asks what's available. Returns products with title, vendor, price range, and PDP URLs — surface those as Markdown links.",
      "ALWAYS pass max_price_cents (and min_price_cents when relevant) when the shopper states a budget — without the filter the catalog will return premium picks alongside the budget ones and the cards will show items outside their range. Convert dollars to cents: 'under $1000' → max_price_cents: 100000.",
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
  {
    // Implemented in-house (Storefront API multi-fetch) — Shopify's
    // hosted MCP has no direct equivalent, so executeHostedTool
    // dispatches this through executeTool('compare_products', ...).
    name: 'compare_products',
    description: [
      "Compare 2 or 3 products side-by-side. Use when the shopper has narrowed",
      "to a small finalist set (e.g. 'should I get the Helix Midnight or the",
      "Tempur ProAdapt?') or when you've recommended multiple options and the",
      "shopper asks 'what's the difference between them'. Returns a structured",
      "comparison object with price, firmness, material, height, vendor, and",
      "rating per product so you can write a tight side-by-side answer without",
      "improvising any spec. Pass handles from prior search_catalog /",
      "get_product results — never invent handles.",
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        handles: {
          type: 'array',
          description: 'Product handles to compare. Must be 2 or 3 handles from a prior catalog search.',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 3,
        },
      },
      required: ['handles'],
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
  /**
   * True when the hosted MCP call failed and the executor fell back
   * to an in-house Storefront tool. The route handler reads this for
   * telemetry (chat_turn_completed.fallback_count) so we can monitor
   * hosted-MCP health from PostHog dashboards.
   */
  fallbackUsed?: boolean;
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
      case 'compare_products':
        // No hosted-MCP equivalent — dispatch through the in-house
        // multi-fetch tool. Output shape is compatible with
        // HostedToolExecution (both use the shared ChatProductCard).
        return toHostedExecution(await executeTool('compare_products', args));
      default:
        return {
          llmContent: JSON.stringify({ error: `Unknown tool: ${name}` }),
          isError: true,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown tool error';
    // Hosted MCP failed (timeout / 5xx / RPC error after retry). Fall
    // back to the in-house Storefront tools so the shopper still gets
    // a real answer instead of "catalog is temporarily unreachable".
    // Sentry breadcrumb tracks fallback frequency so we know when the
    // hosted MCP is degraded; the user-visible response stays clean.
    Sentry.addBreadcrumb({
      category: 'chat.mcp.fallback',
      level: 'warning',
      message: `Hosted MCP ${name} failed, falling back to in-house tools: ${message}`,
      data: { tool: name },
    });
    const fallback = await fallbackToInHouseTool(name, args, message);
    return { ...fallback, fallbackUsed: true };
  }
}

/**
 * When the hosted Shopify MCP fails (timeout, 5xx, malformed
 * response), invoke the equivalent in-house Storefront tool so the
 * shopper still gets a usable answer. Tool-name mapping:
 *
 *   - search_catalog              → search_products (Storefront search)
 *   - get_product                 → get_product     (Storefront product)
 *   - get_cart                    → read_cart       (cookie-backed cart)
 *   - search_shop_policies_and_faqs → soft empty answer; the model
 *       already knows to say "I don't have that detail — call the
 *       showroom" per the system prompt's policy fallback instruction.
 *       Returning `isError: false` with a null answer keeps the model
 *       from blurting "the tool is unreachable" to the user.
 */
async function fallbackToInHouseTool(
  hostedName: string,
  args: Record<string, unknown>,
  originalError: string,
): Promise<HostedToolExecution> {
  switch (hostedName) {
    case 'search_catalog': {
      // Map UCP shape → in-house shape. The hosted tool takes a free
      // `query` plus optional price filters; the in-house tool takes
      // `query` and an optional `limit`. Price filters aren't honored
      // by the fallback — Claude will see the unfiltered results and
      // can narrow in its reply.
      const fallbackInput = {
        query: typeof args.query === 'string' ? args.query : '',
        limit: 6,
      };
      return toHostedExecution(await executeTool('search_products', fallbackInput));
    }
    case 'get_product': {
      return toHostedExecution(await executeTool('get_product', { handle: args.handle }));
    }
    case 'get_cart': {
      return toHostedExecution(await executeTool('read_cart', {}));
    }
    case 'search_shop_policies_and_faqs': {
      // No in-house equivalent. Return a soft empty answer so the
      // model gracefully falls back to its quick-reference essentials
      // and the showroom phone number per system-prompt.ts line 138.
      return {
        llmContent: JSON.stringify({ answer: null, sources: [], _fallback: true }),
      };
    }
    default:
      // Unknown hosted tool — propagate the original error so Claude
      // can apologize correctly.
      return {
        llmContent: JSON.stringify({ error: originalError }),
        isError: true,
      };
  }
}

function toHostedExecution(exec: ToolExecution): HostedToolExecution {
  return {
    llmContent: exec.llmContent,
    uiPayload: exec.uiPayload,
    isError: exec.isError,
  };
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
