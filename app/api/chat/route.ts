import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import * as Sentry from '@sentry/nextjs';
import { CHAT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt';
import type { ChatMessage, ChatStreamEvent } from '@/lib/chat/types';

/**
 * /api/chat — PR-2 of Phase B. Streaming chat backed by Claude Opus 4.7.
 *
 * Wire format:
 *   POST { messages: ChatMessage[] }  → text/event-stream of ChatStreamEvent
 *
 * Persistence model:
 *   Server is intentionally stateless. The client (chat-widget) owns
 *   conversation history in sessionStorage and POSTs the full sliding
 *   window on every turn. We pivoted away from server-side httpOnly
 *   cookies because streaming responses can't write Set-Cookie headers
 *   after the body starts flushing — the alternatives (two-request
 *   stream+commit, or buffering the full assistant reply before
 *   streaming) either added latency or doubled the round-trip count.
 *   Client-side state keeps the wire stateless and lets us add server-
 *   side history later (KV / Supabase) without breaking the contract.
 *
 * Tools: none in PR-2. Storefront MCP tools (search_catalog, get_product,
 * search_shop_policies_and_faqs) land in PR-3 via a custom tool-use loop.
 *
 * Model: claude-opus-4-7. No `temperature` / `top_p` / `top_k` /
 * `budget_tokens` — all removed on Opus 4.7 and would 400. Default
 * thinking is off (no thinking block on the request), which is correct
 * for chat — we want immediate streamed deltas, not a multi-second
 * thinking pause.
 *
 * Prompt caching: the system prompt is ~4,500 tokens (above Opus 4.7's
 * 4,096-token minimum-cacheable-prefix). First request writes the
 * cache at 1.25x input cost; every subsequent request reads it at
 * 0.1x. Verified via `usage.cache_read_input_tokens` on the `done`
 * event.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Streaming chat can take longer than the default 10s Vercel function
// timeout on hobby/standard plans. 60s covers typical multi-sentence
// responses with headroom; cancel-on-disconnect propagates if the
// client aborts.
export const maxDuration = 60;

const MAX_MESSAGES = 20;
const MAX_USER_CHARS = 4000;

type ChatRequestBody = { messages?: unknown };

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { role?: unknown; content?: unknown };
  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string'
  );
}

function sse(payload: ChatStreamEvent): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          'Chat is not configured on this environment. Set ANTHROPIC_API_KEY in Vercel.',
      },
      { status: 503 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json(
      { error: '`messages` must be a non-empty array.' },
      { status: 400 },
    );
  }

  // Reject anything that doesn't conform — never let a malformed prior
  // turn (e.g. role: "system") into the upstream call. Trims silently
  // to keep the chat experience forgiving for stale localStorage shapes.
  const messages: ChatMessage[] = body.messages
    .filter(isChatMessage)
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_USER_CHARS),
    }));

  if (messages.length === 0) {
    return Response.json(
      { error: 'No valid messages in payload.' },
      { status: 400 },
    );
  }

  const last = messages[messages.length - 1];
  if (last.role !== 'user' || last.content.trim().length === 0) {
    return Response.json(
      { error: 'Last message must be a non-empty user turn.' },
      { status: 400 },
    );
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(sse(event)));
      };

      try {
        const aiStream = client.messages.stream({
          model: 'claude-opus-4-7',
          // 2048 covers a long-form recommendation comfortably. Streaming
          // means we don't pay for unused headroom; bumping doesn't hurt
          // if a single answer ever feels truncated.
          max_tokens: 2048,
          system: [
            {
              type: 'text',
              text: CHAT_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        });

        for await (const event of aiStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            send({ type: 'delta', text: event.delta.text });
          }
        }

        const final = await aiStream.finalMessage();
        send({
          type: 'done',
          stop_reason: final.stop_reason ?? null,
          usage: {
            input_tokens: final.usage.input_tokens,
            output_tokens: final.usage.output_tokens,
            cache_read_input_tokens: final.usage.cache_read_input_tokens ?? 0,
          },
        });
      } catch (err) {
        // Convert SDK errors to a structured SSE event so the client can
        // surface a user-readable message and Sentry can ingest the
        // stack. Specific error types get specific user copy via the
        // status field (rate limit → "we're busy, try again").
        const isApiError = err instanceof Anthropic.APIError;
        const message = isApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unknown error.';
        const status = isApiError ? err.status : undefined;
        Sentry.captureException(err, {
          tags: { route: '/api/chat' },
          extra: { messages_count: messages.length, status },
        });
        send({ type: 'error', message, status });
      } finally {
        controller.close();
      }
    },
    cancel() {
      // Client closed the stream early (user dismissed the chat panel
      // mid-response, navigated away, etc.). No-op — the upstream SDK
      // stream is iterator-backed and will GC when the route handler
      // exits.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      Connection: 'keep-alive',
      // Disables intermediary buffering on nginx-like proxies so deltas
      // reach the browser as they're produced.
      'X-Accel-Buffering': 'no',
    },
  });
}
