import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import * as Sentry from '@sentry/nextjs';
import { CHAT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt';
import { CHAT_TOOLS, executeTool } from '@/lib/chat/tools';
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
 * Tools (PR-3): search_products and get_product, executed locally via
 * our Storefront API wrappers (see lib/chat/tools.ts for the rationale
 * on why we run tools in-process rather than calling Shopify's hosted
 * Storefront MCP). The custom tool-use loop iterates the assistant's
 * tool_use blocks, executes each tool, appends tool_result messages,
 * and re-invokes the stream until Claude stops calling tools.
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

/**
 * Human-readable preview of a tool call, surfaced to the client UI as
 * the body of a "Searching for X..." indicator. Kept terse so it fits
 * on one line on mobile.
 */
function summarizeToolUse(name: string, input: unknown): string {
  if (typeof input !== 'object' || input === null) return name;
  const obj = input as Record<string, unknown>;
  if (name === 'search_products' && typeof obj.query === 'string') {
    return `Searching for "${obj.query.slice(0, 80)}"`;
  }
  if (name === 'get_product' && typeof obj.handle === 'string') {
    return `Looking up ${obj.handle.slice(0, 80)}`;
  }
  return name;
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
        // Custom tool-use loop. Each iteration:
        //   1. Open a streaming Messages call with the running history.
        //   2. Forward text deltas to the client as `delta` SSE events.
        //   3. Collect any tool_use blocks Claude emits.
        //   4. If none → stream-done with stop_reason=end_turn, exit.
        //   5. If any → append the assistant turn (full content blocks)
        //      to the running history, execute each tool, append a
        //      single user turn with all tool_result blocks, and loop.
        //
        // MAX_LOOP_ITERATIONS guards against runaway tool-call recursion
        // — Claude is well-behaved here in practice but a runaway loop
        // would burn API spend and stream tokens uselessly. 4 covers
        // typical "search → narrow → search again → answer" flows.
        const MAX_LOOP_ITERATIONS = 4;

        // Running conversation. We start from the client-supplied
        // history (validated above) and append the assistant + tool
        // turns Claude generates across loop iterations. Sliced to
        // Anthropic's message-param shape.
        type AnthropicMessageParam = Anthropic.Messages.MessageParam;
        const running: AnthropicMessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let finalStopReason: string | null = null;
        let finalUsage: {
          input_tokens: number;
          output_tokens: number;
          cache_read_input_tokens: number;
        } = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };

        for (let iter = 0; iter < MAX_LOOP_ITERATIONS; iter += 1) {
          const aiStream = client.messages.stream({
            model: 'claude-opus-4-7',
            max_tokens: 2048,
            system: [
              {
                type: 'text',
                text: CHAT_SYSTEM_PROMPT,
                cache_control: { type: 'ephemeral' },
              },
            ],
            tools: CHAT_TOOLS,
            messages: running,
          });

          // Forward text deltas as they arrive. Tool-input deltas
          // (input_json_delta) are NOT forwarded — the client gets a
          // single `tool_use` event after the block completes.
          for await (const event of aiStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              send({ type: 'delta', text: event.delta.text });
            }
          }

          const final = await aiStream.finalMessage();
          finalStopReason = final.stop_reason ?? null;
          // Accumulate usage across loop iterations so the client sees
          // the total cost of the turn, not just the last sub-call.
          finalUsage = {
            input_tokens: finalUsage.input_tokens + final.usage.input_tokens,
            output_tokens: finalUsage.output_tokens + final.usage.output_tokens,
            cache_read_input_tokens:
              finalUsage.cache_read_input_tokens + (final.usage.cache_read_input_tokens ?? 0),
          };

          const toolUses = final.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
          );

          if (toolUses.length === 0) {
            // No tool calls → Claude is done. Exit the loop and emit
            // the terminal `done` event below.
            break;
          }

          // Persist the assistant's full content (text + tool_use blocks)
          // so the next iteration's request carries them as the
          // immediately-prior turn — required for tool_result correlation.
          running.push({ role: 'assistant', content: final.content });

          // Execute every tool_use block in parallel — they're
          // independent reads against the Storefront API.
          const executions = await Promise.all(
            toolUses.map(async (tu) => {
              send({
                type: 'tool_use',
                tool: tu.name as 'search_products' | 'get_product',
                id: tu.id,
                summary: summarizeToolUse(tu.name, tu.input),
              });
              const result = await executeTool(tu.name, tu.input);
              if (result.uiPayload) {
                send({
                  type: 'tool_result',
                  id: tu.id,
                  payload: result.uiPayload,
                  isError: result.isError,
                });
              }
              return { toolUseId: tu.id, result };
            }),
          );

          // Append a single user turn containing one tool_result block
          // per executed tool. Order matches the assistant's
          // tool_use order (Anthropic doesn't strictly require it, but
          // matching reduces correlation surprises in logs).
          running.push({
            role: 'user',
            content: executions.map((e) => ({
              type: 'tool_result' as const,
              tool_use_id: e.toolUseId,
              content: e.result.llmContent,
              is_error: e.result.isError ?? false,
            })),
          });

          // If we hit the iteration cap with tool calls still pending,
          // break out so we emit `done` and let the client recover.
          if (iter === MAX_LOOP_ITERATIONS - 1) {
            Sentry.captureMessage(
              `[/api/chat] tool-use loop hit MAX_LOOP_ITERATIONS=${MAX_LOOP_ITERATIONS}; ${toolUses.length} tools still pending`,
              'warning',
            );
            break;
          }
        }

        send({
          type: 'done',
          stop_reason: finalStopReason,
          usage: finalUsage,
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
