'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../icon';
import type { ChatMessage, ChatStreamEvent } from '@/lib/chat/types';

/**
 * The interactive body of the chat panel: message list + input form +
 * streaming response handling. Lives inside <ChatWidget /> when the
 * panel is open; mounted/unmounted with the open state so a closed
 * chat doesn't hold a streaming fetch open.
 *
 * Persistence: conversation history lives in sessionStorage under
 * STORAGE_KEY. The server is stateless; we POST the full sliding
 * window on every turn and let the server apply its own cap. This
 * keeps the wire format simple and the server free of session state.
 * Tab close ends the conversation; refresh keeps it.
 *
 * Streaming: parses Server-Sent Events (`data: <json>\n\n` per event)
 * incrementally from the ReadableStream body. AbortController lets
 * the user cancel mid-response (via close button) or the next message
 * preempt an in-flight one. Errors surface as a system bubble — never
 * silent.
 */

const STORAGE_KEY = 'la-mattress.chat.v1';
const MAX_STORED_MESSAGES = 20;
const MAX_INPUT_CHARS = 4000;

const SUGGESTED_PROMPTS = [
  'What mattress is best for back pain?',
  'Compare Tempur-Pedic and Stearns & Foster',
  "I'm a side sleeper under 150 lbs — what would you recommend?",
  "What's your return policy?",
];

type DisplayMessage = ChatMessage & {
  // Local-only state; never persisted or sent upstream.
  streaming?: boolean;
  error?: boolean;
};

function loadHistory(): DisplayMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is ChatMessage => {
        if (typeof m !== 'object' || m === null) return false;
        const v = m as { role?: unknown; content?: unknown };
        return (
          (v.role === 'user' || v.role === 'assistant') &&
          typeof v.content === 'string'
        );
      })
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

function persistHistory(messages: DisplayMessage[]) {
  try {
    // Strip local-only fields before write so a refresh restores into a
    // clean state.
    const stripped: ChatMessage[] = messages
      .filter((m) => !m.error && m.content.trim().length > 0)
      .slice(-MAX_STORED_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
  } catch {
    /* quota exceeded / disabled — silently drop, conversation lives in
       React state for the rest of the visit. */
  }
}

export function ChatConversation() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore once on mount. We don't read storage in the initial state
  // because Next.js SSRs this component (storage is undefined on the
  // server) and React 19 hydration would mismatch.
  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) persistHistory(messages);
  }, [messages, hydrated]);

  // Scroll-to-bottom whenever messages change. `behavior: 'auto'` (not
  // 'smooth') for streaming because token deltas arrive faster than
  // smooth scroll can complete and the animation gets pinned partway.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  // Cancel any in-flight stream on unmount (panel close, route nav).
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      if (trimmed.length > MAX_INPUT_CHARS) return;

      // If a previous stream is still going (rapid Enter / suggestion
      // tap), cancel it so we don't interleave two assistant turns.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const userMsg: DisplayMessage = { role: 'user', content: trimmed };
      const assistantPlaceholder: DisplayMessage = {
        role: 'assistant',
        content: '',
        streaming: true,
      };

      // Snapshot the messages array WITHOUT the placeholder for the
      // upstream payload — the assistant placeholder is local UI only,
      // not part of the conversation Claude sees.
      const upstreamMessages: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: userMsg.role, content: userMsg.content },
      ];

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setInput('');
      setIsStreaming(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: upstreamMessages }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          let errMessage = `Chat unavailable (HTTP ${res.status}).`;
          try {
            const json = (await res.json()) as { error?: string };
            if (typeof json.error === 'string') errMessage = json.error;
          } catch {
            /* non-JSON body, keep the generic */
          }
          throw new Error(errMessage);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // SSE event delimiter is a blank line (`\n\n`). Buffer partial
        // chunks across reads — TextDecoder({stream: true}) handles
        // multi-byte UTF-8 boundaries.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary: number;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            // Only `data:` lines carry payload. We don't emit named
            // events from the server, so anything else is ignored.
            const dataLine = rawEvent
              .split('\n')
              .find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            const json = dataLine.slice(5).trim();
            if (!json) continue;
            let event: ChatStreamEvent;
            try {
              event = JSON.parse(json) as ChatStreamEvent;
            } catch {
              continue;
            }
            if (event.type === 'delta') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant' && last.streaming) {
                  next[next.length - 1] = {
                    ...last,
                    content: last.content + event.text,
                  };
                }
                return next;
              });
            } else if (event.type === 'error') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant' && last.streaming) {
                  next[next.length - 1] = {
                    role: 'assistant',
                    content:
                      last.content ||
                      "I hit an error mid-response. Try again, or call (213) 984-4654.",
                    streaming: false,
                    error: true,
                  };
                }
                return next;
              });
            }
            // `done` events are informational (stop_reason + usage) —
            // we let the reader EOF flip the streaming flag below.
          }
        }
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === 'AbortError'
        ) {
          // Intentional cancel — leave whatever partial text the
          // assistant produced visible, just mark the placeholder done.
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant' && last.streaming) {
              next[next.length - 1] = { ...last, streaming: false };
            }
            return next;
          });
        } else {
          const msg = err instanceof Error ? err.message : 'Network error.';
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant' && last.streaming) {
              next[next.length - 1] = {
                role: 'assistant',
                content: msg,
                streaming: false,
                error: true,
              };
            }
            return next;
          });
        }
      } finally {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.role === 'assistant' && m.streaming ? { ...m, streaming: false } : m,
          ),
        );
        // Refocus the input so the shopper can keep typing without
        // chasing the cursor.
        textareaRef.current?.focus();
      }
    },
    [isStreaming, messages],
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline. Industry-standard
    // chat input behaviour.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const showSuggestions = messages.length === 0;

  return (
    <>
      <div className="chat-panel-body" ref={scrollRef}>
        {showSuggestions ? (
          <>
            <div className="chat-msg chat-msg-assistant">
              <p>
                Hi! I&rsquo;m a sleep assistant. Ask me about mattresses, brands,
                sleep position, returns, or financing — anything that helps you
                pick the right bed.
              </p>
            </div>
            <div className="chat-suggestions" aria-label="Example questions">
              <p className="chat-suggestions-eyebrow muted">Try asking</p>
              <ul role="list">
                {SUGGESTED_PROMPTS.map((p) => (
                  <li key={p} role="listitem">
                    <button
                      type="button"
                      className="chat-suggestion-pill chat-suggestion-pill-clickable"
                      onClick={() => void send(p)}
                      disabled={isStreaming}
                    >
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-msg chat-msg-${m.role}${m.error ? ' chat-msg-error' : ''}`}
          >
            {m.content
              .split('\n')
              .map((line, j) => (line.length > 0 ? <p key={j}>{line}</p> : <br key={j} />))}
            {m.streaming && m.content.length === 0 ? (
              <span className="chat-typing" aria-label="Assistant is typing">
                <span></span>
                <span></span>
                <span></span>
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <form className="chat-panel-foot" onSubmit={onSubmit}>
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={
              isStreaming ? 'Assistant is responding…' : 'Ask about mattresses, brands, sleep…'
            }
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_CHARS))}
            onKeyDown={onKeyDown}
            disabled={isStreaming}
            aria-label="Chat message"
            maxLength={MAX_INPUT_CHARS}
          />
          <button
            type="submit"
            className="chat-send"
            disabled={isStreaming || input.trim().length === 0}
            aria-label="Send message"
          >
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
        <p className="chat-foot-disclosure muted">
          AI responses can be inaccurate. Verify pricing &amp; stock in cart.
        </p>
      </form>
    </>
  );
}
