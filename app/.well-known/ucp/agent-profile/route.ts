import { NextResponse } from 'next/server';

/**
 * UCP agent profile for Shopify's hosted Storefront Catalog MCP.
 *
 * Phase ~300: migrating the chat assistant from custom Storefront API
 * wrappers (lib/chat/tools.ts) onto Shopify's hosted MCP server
 * (`/api/ucp/mcp` and `/api/mcp` on the shop's `*.myshopify.com`
 * domain). The UCP catalog endpoint requires every request to include
 * a `meta.ucp-agent.profile` URL pointing to a JSON document
 * describing the agent's capabilities. This route serves that
 * document.
 *
 * Why a `.well-known`-style URL: industry-standard discovery pattern
 * (RFC 8615) — keeps the agent profile at a stable, predictable path
 * the same way `/robots.txt` and `/.well-known/security.txt` work,
 * and matches what Shopify's tutorials use.
 *
 * Spec reference:
 *   - https://shopify.dev/docs/apps/build/storefront-mcp
 *   - https://shopify.dev/docs/agents/catalog/storefront-catalog
 *
 * Cache headers: long TTL (1 day) with stale-while-revalidate so any
 * change to the profile shape rolls out within a deploy cycle. Set
 * `Content-Type: application/json` so Shopify's catalog endpoint
 * accepts the profile without sniffing.
 */

export const runtime = 'edge';
export const dynamic = 'force-static';

const AGENT_PROFILE = {
  // UCP agent profile — declares what catalog capabilities our chat
  // agent expects from the hosted MCP. The Shopify MCP server uses
  // this to decide which tools to expose in tools/list (e.g. our
  // agent doesn't currently do image-search or cross-merchant lookup,
  // so we don't advertise those).
  '@context': 'https://commerce.protocol.org/agent/v1',
  '@type': 'AgentProfile',
  name: 'LA Mattress Store Chat',
  description:
    'Conversational shopping assistant for mattressstoreslosangeles.com. Helps shoppers find a mattress, check cart contents, and answers policy / financing / showroom questions.',
  capabilities: {
    catalog: {
      // We use search_catalog + get_product for the chat flow. No
      // image-similarity search, no cross-merchant search.
      search: { text: true, image: false, similar: false },
      lookup: { byId: true },
      get_product: { variants: true },
    },
    cart: { read: true, write: true },
    policies_and_faqs: { read: true },
  },
  // Locale defaults. Shopify uses these when the chat doesn't pass
  // explicit `context.address_country` / `language` per request.
  locale: { country: 'US', language: 'en', currency: 'USD' },
  // Contact for hosted-MCP operators to reach in case of abuse.
  contact: { email: 'hello@mattressstoreslosangeles.com' },
} as const;

export function GET() {
  return NextResponse.json(AGENT_PROFILE, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 1 day fresh, 1 week stale-while-revalidate. Profile shape is
      // stable; we don't change it per request.
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
