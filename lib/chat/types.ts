/**
 * Shared message + SSE event shapes for the MCP chat assistant.
 * Single source of truth for the wire format between
 * app/api/chat/route.ts and app/_components/chat/chat-conversation.tsx.
 */

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/**
 * Compact product card shape — same fields the client renders inline
 * inside a chat message when a tool returns products. Kept lean so the
 * SSE payload stays small.
 */
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

/**
 * Events streamed from /api/chat as Server-Sent Events. Each line on the
 * SSE stream is `data: <JSON>\n\n`; the JSON parses into one of these.
 *
 * Order is enforced by the route handler:
 *   1. zero-or-more `delta` events (assistant text streaming)
 *   2. zero-or-more `tool_use` events (assistant called a tool — UI
 *      can show a "Looking up mattresses…" indicator)
 *   3. zero-or-more `tool_result` events (carries the structured
 *      payload for inline product cards; arrives just before the
 *      next round of `delta` events)
 *   4. exactly one `done` event (or one `error` event on failure)
 */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'tool_use';
      tool: 'search_products' | 'get_product';
      /** Stable id we issue so tool_result can be paired to its tool_use in the UI. */
      id: string;
      /** Human-readable preview of what the assistant is doing, e.g. "Searching for cooling hybrid queen". */
      summary: string;
    }
  | {
      type: 'tool_result';
      id: string;
      payload:
        | { kind: 'products'; cards: ChatProductCard[] }
        | { kind: 'product'; card: ChatProductCard };
      isError?: boolean;
    }
  | {
      type: 'done';
      stop_reason: string | null;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens: number;
      };
    }
  | { type: 'error'; message: string; status?: number };
