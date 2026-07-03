'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../icon';
import { ChatProductCard } from './chat-product-card';
import type {
  ChatMessage,
  ChatStreamEvent,
  ChatProductCard as ChatProductCardData,
} from '@/lib/chat/types';
import { parseChatStreamChunk } from '@/lib/chat/sse-parser';

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
const SESSION_ID_KEY = 'la-mattress.chat.session_id.v1';
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_STORED_MESSAGES = 20;
const MAX_INPUT_CHARS = 4000;

/**
 * Per-chat session UUID. Generated lazily on first send, persisted in
 * sessionStorage so it survives refresh (matches the history-persistence
 * model) and dies on tab close (one chat session = one tab visit).
 * Sent to /api/chat in the request body; the server uses it as PostHog
 * distinct_id so all turns in one chat correlate into a session.
 */
function getOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  const newId = () =>
    typeof window.crypto?.randomUUID === 'function' ? window.crypto.randomUUID() : null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing && SESSION_ID_RE.test(existing)) return existing;
    const fresh = newId();
    if (fresh) window.sessionStorage.setItem(SESSION_ID_KEY, fresh);
    return fresh;
  } catch {
    // sessionStorage disabled / quota exceeded — fall back to an
    // in-memory id for this React tree. Loses session correlation
    // across reloads but keeps distinct_id stable for this visit.
    return newId();
  }
}

const SUGGESTED_PROMPTS = [
  'What mattress is best for back pain?',
  'Compare Tempur-Pedic and Stearns & Foster',
  "I'm a side sleeper under 150 lbs — what would you recommend?",
  "What's your return policy?",
];

/**
 * Map a raw upstream error (Anthropic API error, fetch failure, SSE
 * error event) to a clean user-facing message. Shoppers should never
 * see "HTTP 504", "Anthropic API error", or any other backend jargon —
 * give them an actionable next step (try again / call the showroom)
 * instead. The raw message still goes to console for dev visibility
 * and to Sentry from the server side.
 */
function friendlyChatError(rawMessage: string, status?: number): string {
  if (typeof window !== 'undefined') {
    // Surface the raw cause for dev debugging without showing it.
    // eslint-disable-next-line no-console
    console.error('[chat]', status ? `status ${status}` : '', rawMessage);
  }
  if (status === 429) {
    return "We're getting a lot of questions right now. Give it a moment and try again.";
  }
  if (status === 503) {
    return "The chat assistant is briefly unavailable. Call (800) 218-3578 or try again in a minute.";
  }
  if (status === 504 || /timeout|timed out/i.test(rawMessage)) {
    return "That took longer than expected. Try a shorter question, or call (213) 984-4654.";
  }
  if (typeof status === 'number' && status >= 400) {
    return "Something went wrong on our end. Try rephrasing, or call (213) 984-4654.";
  }
  if (/network|fetch|failed to fetch/i.test(rawMessage)) {
    return "Looks like a connection hiccup. Check your network and try again.";
  }
  return "I hit an error mid-response. Try again, or call (213) 984-4654.";
}

/**
 * Inline-attachment shown alongside a chat message. Tool calls Claude
 * makes during a turn render as one of these — either an in-flight
 * "Searching for X..." indicator while the tool runs, or the result
 * cards once the tool returns. Pairing is by `id` so out-of-order
 * results land in the right spot.
 */
type ChatAttachment =
  | { kind: 'tool_pending'; id: string; tool: string; summary: string }
  | {
      kind: 'tool_result';
      id: string;
      payload:
        | { kind: 'products'; cards: ChatProductCardData[] }
        | { kind: 'product'; card: ChatProductCardData };
      isError?: boolean;
    };

type DisplayMessage = ChatMessage & {
  // Local-only state; never persisted or sent upstream.
  streaming?: boolean;
  error?: boolean;
  attachments?: ChatAttachment[];
};

/**
 * Render a single line of Claude output with minimal Markdown support:
 *   - **bold**     → <strong>
 *   - [text](url)  → <a> (internal URLs only — drop external for safety)
 *
 * Anything else passes through as plain text. We intentionally do NOT
 * pull in react-markdown for this — it's 30KB+, and the system prompt
 * already restricts the assistant to bold + links + bullets. Bullets
 * render natively because they're plain "- " prefixes in the text.
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Tokenize on **bold** and [text](url) in a single pass. Greedy
  // matching is fine because both delimiter pairs are unambiguous.
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      // **bold**
      out.push(<strong key={`b${keyCounter++}`}>{match[2]}</strong>);
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const url = match[4];
      // Only render internal-path links as anchors. External links
      // (http:// or //) render as plain text — the system prompt
      // already instructs the assistant not to emit external URLs,
      // but defense-in-depth catches a bad day.
      if (url.startsWith('/') && !url.startsWith('//')) {
        out.push(
          <a key={`a${keyCounter++}`} href={url}>
            {match[3]}
          </a>,
        );
      } else {
        out.push(`${match[3]} (${url})`);
      }
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }
  return out.length > 0 ? out : text;
}

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
  // Sticky-to-bottom state. True when the shopper is already near the
  // bottom of the transcript — in that case streaming deltas should
  // keep pushing new content into view. False when the shopper has
  // scrolled up to re-read; we leave them alone so they can finish
  // reading without the page yanking out from under them. A ref (not
  // state) so the auto-scroll effect doesn't re-run when the flag flips.
  const pinnedToBottomRef = useRef(true);

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

  // Sticky-to-bottom auto-scroll. Only scrolls when the shopper is
  // already pinned near the bottom (within SLOP px). If they've
  // scrolled up to re-read an earlier answer, the streaming response
  // grows without disturbing their scroll position — industry-
  // standard chat UX (ChatGPT, Claude.ai, Slack). `behavior: 'auto'`
  // for streaming because token deltas fire faster than smooth scroll
  // can complete and the animation gets pinned partway.
  useEffect(() => {
    if (!pinnedToBottomRef.current) return;
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

      // Sending a new turn always re-pins to bottom — the shopper
      // just typed; they want to see their own message and the
      // incoming response. Resets the sticky-to-bottom flag in case
      // they had scrolled up during the previous turn.
      pinnedToBottomRef.current = true;
      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setInput('');
      setIsStreaming(true);

      try {
        const sessionId = getOrCreateSessionId();
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: upstreamMessages,
            ...(sessionId ? { session_id: sessionId } : {}),
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          let rawError = `HTTP ${res.status}`;
          try {
            const json = (await res.json()) as { error?: string };
            if (typeof json.error === 'string') rawError = json.error;
          } catch {
            /* non-JSON body, keep the status code */
          }
          // Throw a friendly message — the raw cause is logged inside
          // friendlyChatError() for dev visibility.
          throw new Error(friendlyChatError(rawError, res.status));
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // SSE event delimiter is a blank line (`\n\n`). Buffer partial
        // chunks across reads — TextDecoder({stream: true}) handles
        // multi-byte UTF-8 boundaries; parseChatStreamChunk handles
        // event-boundary buffering and JSON parsing (unit-tested in
        // tests/ssr/lib-chat-sse-parser.test.mjs).
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const decoded = decoder.decode(value, { stream: true });
          const { events, buffer: nextBuffer } = parseChatStreamChunk(buffer, decoded);
          buffer = nextBuffer;
          for (const event of events) {
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
            } else if (event.type === 'tool_use') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant' && last.streaming) {
                  const attachments = [...(last.attachments ?? [])];
                  attachments.push({
                    kind: 'tool_pending',
                    id: event.id,
                    tool: event.tool,
                    summary: event.summary,
                  });
                  next[next.length - 1] = { ...last, attachments };
                }
                return next;
              });
            } else if (event.type === 'tool_result') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant' && last.streaming) {
                  const attachments = (last.attachments ?? []).map((a) =>
                    a.kind === 'tool_pending' && a.id === event.id
                      ? ({
                          kind: 'tool_result' as const,
                          id: event.id,
                          payload: event.payload,
                          isError: event.isError,
                        })
                      : a,
                  );
                  next[next.length - 1] = { ...last, attachments };
                }
                return next;
              });
            } else if (event.type === 'error') {
              const friendly = friendlyChatError(event.message, event.status);
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant' && last.streaming) {
                  // Preserve any partial text the assistant already
                  // streamed — only show the error copy if we have
                  // nothing else to show.
                  next[next.length - 1] = {
                    role: 'assistant',
                    content: last.content || friendly,
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
          // err.message is already a friendly string when it came from
          // the HTTP-error throw path above (we threw friendlyChatError
          // there). For any other thrown error (network failure,
          // unexpected exception), sanitize before showing.
          const raw = err instanceof Error ? err.message : 'Network error.';
          const looksFriendly = /\(213\) 984-4654|try again|connection hiccup|moment/i.test(raw);
          const content = looksFriendly ? raw : friendlyChatError(raw);
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant' && last.streaming) {
              next[next.length - 1] = {
                role: 'assistant',
                content,
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
      <div
        className="chat-panel-body"
        ref={scrollRef}
        onScroll={(e) => {
          // Track sticky-to-bottom state on user scroll. SLOP gives
          // a 40px tolerance so subpixel rounding / momentum scrolling
          // doesn't accidentally unpin. Threshold-checked, not
          // strictly-equal: a shopper who lands within ~40px of the
          // bottom is considered "following along" and gets the
          // auto-scroll behavior.
          const SLOP = 40;
          const node = e.currentTarget;
          pinnedToBottomRef.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < SLOP;
        }}
        // role="log" tells assistive tech this is a conversation
        // transcript; new entries should be announced as they arrive
        // without re-reading the whole list. aria-live="polite" is
        // the implicit default for role="log" but stated explicitly
        // for older AT. aria-atomic="false" keeps the announcer from
        // reading the whole transcript on each update — only the new
        // delta. aria-busy flips during streaming so screen readers
        // can hint that a response is in progress.
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Conversation with the sleep assistant"
        aria-busy={isStreaming}
      >
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
          <div key={i} className="chat-turn">
            <div
              className={`chat-msg chat-msg-${m.role}${m.error ? ' chat-msg-error' : ''}`}
              // Error messages should interrupt the screen reader so
              // shoppers immediately hear what went wrong (rate limit,
              // outage, network blip). Regular turns ride the log
              // region's polite announce.
              {...(m.error ? { role: 'alert' } : {})}
            >
              {m.content
                .split('\n')
                .map((line, j) =>
                  line.length > 0 ? (
                    <p key={j}>{renderInlineMarkdown(line)}</p>
                  ) : (
                    <br key={j} />
                  ),
                )}
              {m.streaming && m.content.length === 0 && !m.attachments?.length ? (
                <span className="chat-typing" aria-label="Assistant is typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              ) : null}
            </div>
            {m.attachments?.map((att) =>
              att.kind === 'tool_pending' ? (
                <div key={att.id} className="chat-tool-pending" aria-live="polite">
                  <span className="chat-typing" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  <span>{att.summary}</span>
                </div>
              ) : att.payload.kind === 'products' ? (
                <div key={att.id} className="chat-cards">
                  {att.payload.cards.length === 0 ? (
                    <p className="chat-tool-empty muted">
                      No matches found. Try different keywords.
                    </p>
                  ) : (
                    att.payload.cards.map((card) => (
                      <ChatProductCard key={card.handle} card={card} />
                    ))
                  )}
                </div>
              ) : (
                <div key={att.id} className="chat-cards">
                  <ChatProductCard card={att.payload.card} />
                </div>
              ),
            )}
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
            // Pair the input with the AI-disclosure note so the
            // shopper hears the disclaimer when the field is focused.
            aria-describedby="chat-foot-disclosure"
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
        <p id="chat-foot-disclosure" className="chat-foot-disclosure muted">
          AI responses can be inaccurate. Verify pricing &amp; stock in cart.
        </p>
      </form>
    </>
  );
}
