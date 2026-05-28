import 'server-only';
import { PostHog } from 'posthog-node';
import { randomUUID } from 'node:crypto';

/**
 * Server-side PostHog telemetry for the chat assistant.
 *
 * Mirrors the pattern used by app/api/webhooks/shopify/order-paid:
 * lazy singleton client, flushAt: 1 so events land within the
 * serverless function lifetime, shutdown() called at the end of each
 * handler to wait for the network flush.
 *
 * Distinct id: the client generates a per-chat session UUID (stored
 * in sessionStorage; survives refresh, dies on tab close) and sends
 * it with every chat request. Server uses it as PostHog distinct_id
 * so all turns from one chat correlate into a session — unlocks
 * funnel + retention queries. When the client doesn't send one
 * (legacy request, bad payload), we fall back to a per-turn UUID.
 */

const POSTHOG_KEY =
  process.env.POSTHOG_PROJECT_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;

function getPostHog(): PostHog | null {
  if (posthogClient) return posthogClient;
  if (!POSTHOG_KEY) return null;
  posthogClient = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return posthogClient;
}

export type ChatTurnProperties = {
  /**
   * Client-generated chat session id (UUID v4 from sessionStorage).
   * Optional — when missing we mint a per-turn id so telemetry still
   * works for clients that don't send one.
   */
  session_id?: string | null;
  /** Total wall-clock duration of the route handler, milliseconds. */
  duration_ms: number;
  /** Number of messages in the conversation window (after server-side cap). */
  messages_count: number;
  /** Number of tool_use blocks Claude emitted across all loop iterations. */
  tool_calls_count: number;
  /** Distinct tool names called this turn (e.g. ["search_catalog", "compare_products"]). */
  tools_called: string[];
  /** How many tool calls fell back from hosted MCP to in-house tools. */
  fallback_count: number;
  /** How many tool-use loop iterations ran (caps at MAX_LOOP_ITERATIONS = 4). */
  loop_iterations: number;
  /** Anthropic stop_reason — end_turn, tool_use, max_tokens, etc. */
  stop_reason: string | null;
  /** Anthropic input tokens, summed across loop iterations. */
  input_tokens: number;
  /** Anthropic output tokens, summed across loop iterations. */
  output_tokens: number;
  /** Cache-hit tokens — high ratio = system prompt cache is working. */
  cache_read_input_tokens: number;
  /** True if the route caught an error and emitted an SSE error event. */
  has_error: boolean;
  /** Which tool surface is active (hosted MCP vs in-house). */
  hosted_mcp: boolean;
};

export async function captureChatTurn(props: ChatTurnProperties): Promise<void> {
  const client = getPostHog();
  if (!client) return;
  // Use the client-supplied session id so all turns in one chat
  // share a distinct_id and land in the same PostHog session.
  // Fall back to a per-turn UUID for clients that don't send one.
  const distinctId = props.session_id
    ? `chat-session-${props.session_id}`
    : `chat-anon-${randomUUID()}`;
  client.capture({
    distinctId,
    event: 'chat_turn_completed',
    properties: {
      ...props,
      // Derived stats so PostHog Insights doesn't have to compute them.
      cache_hit_ratio:
        props.input_tokens > 0 ? props.cache_read_input_tokens / props.input_tokens : 0,
      fallback_ratio:
        props.tool_calls_count > 0 ? props.fallback_count / props.tool_calls_count : 0,
    },
  });
  // Best-effort flush. Errors here shouldn't bubble — telemetry is
  // side-channel and must never break a chat response.
  try {
    await client.shutdown();
  } catch {
    /* swallow */
  }
  posthogClient = null;
}
