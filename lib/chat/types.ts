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
 * Events streamed from /api/chat as Server-Sent Events. Each line on the
 * SSE stream is `data: <JSON>\n\n`; the JSON parses into one of these.
 */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
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
