'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '../icon';
import { track } from '@/lib/analytics';
import { useFocusTrap } from '../use-focus-trap';
import { useBodyScrollLock } from '../use-body-scroll-lock';

/**
 * Floating chat widget — PR-1 of the MCP chat-shopping build.
 *
 * This ships the UI shell only: the bubble opens/closes a panel, the
 * panel renders a "coming soon" placeholder + suggested prompts. No
 * Claude wiring yet — that lands in PR-2 (/api/chat streaming) with
 * Storefront MCP tools in PR-3.
 *
 * Why ship the chrome separately:
 *   - Lets us validate the UX shape (bubble placement, panel size,
 *     mobile breakpoint, focus trap, scroll lock) before the AI
 *     answers are in the loop and start dominating QA attention.
 *   - Visible "coming soon" placeholder is honest UX vs. a chatbot
 *     that fakes responses — readers can't tell the difference until
 *     the integration ships, by which point we've burned trust.
 *
 * Positioning: bottom-right (industry default — Intercom, Drift, every
 * mainstream chat widget). z-90 (above QuizFab's 75, which has been
 * bumped up by 80px so they stack vertically rather than overlap on
 * the same anchor point).
 *
 * Hidden on the same routes as QuizFab (/admin, /account) — chat in
 * the admin dashboard makes no sense, and shopper questions belong on
 * shopping surfaces. Stays visible on /sleep-quiz + /cart (unlike
 * QuizFab) because the chat IS the assistant that can answer mid-quiz
 * questions and mid-cart edits.
 */
const HIDDEN_PREFIXES = ['/admin', '/account'];

function isHidden(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Suggested prompts surfaced when the panel opens. Phrased as questions
// a real shopper actually asks in showrooms — drives discovery of
// what the chat *will* be able to do once the LLM lands in PR-2.
const SUGGESTED_PROMPTS = [
  'What mattress is best for back pain?',
  'Compare Tempur-Pedic vs Stearns & Foster',
  "I'm a side sleeper under 150 lbs — what would you recommend?",
  "What's your return policy?",
];

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Reuse the focus-trap + scroll-lock primitives the cart drawer + nav
  // mobile menu already depend on, so chat shares their a11y contract.
  useFocusTrap(open, panelRef);
  useBodyScrollLock(open);

  // Close on Escape — universal modal pattern.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        track('chat_dismissed', { source: 'escape', pathname });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pathname]);

  // Close on route change — a shopper who navigates away clearly
  // doesn't want the panel obscuring the new page. Re-opens on next tap.
  // Tracked separately so we can read engagement (nav-away mid-chat =
  // strong signal vs. intentional close).
  useEffect(() => {
    if (open) {
      setOpen(false);
      track('chat_dismissed', { source: 'route_change', pathname });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (isHidden(pathname)) return null;

  const onOpen = () => {
    setOpen(true);
    track('chat_opened', { pathname });
  };

  const onClose = (source: 'button' | 'backdrop') => {
    setOpen(false);
    track('chat_dismissed', { source, pathname });
  };

  return (
    <>
      <button
        type="button"
        className={`chat-bubble${open ? ' is-open' : ''}`}
        onClick={onOpen}
        aria-label="Open AI shopping assistant"
        aria-expanded={open}
        aria-controls="chat-panel"
        // When the panel is open we hide the bubble from the
        // accessibility tree — the close button inside the panel is
        // the primary control at that point.
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
      >
        <Icon name="chat" size={22} />
        <span className="chat-bubble-pulse" aria-hidden="true" />
      </button>

      {open ? (
        <>
          <div
            className="chat-backdrop"
            onClick={() => onClose('backdrop')}
            aria-hidden="true"
          />
          <aside
            id="chat-panel"
            ref={panelRef}
            className="chat-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-panel-title"
          >
            <header className="chat-panel-head">
              <div className="chat-panel-head-meta">
                <div className="chat-panel-head-icon" aria-hidden="true">
                  <Icon name="chat" size={16} />
                </div>
                <div className="chat-panel-head-text">
                  <h2 id="chat-panel-title" className="chat-panel-title">
                    Sleep Assistant
                  </h2>
                  <p className="chat-panel-subtitle muted">AI shopping help · powered by Claude</p>
                </div>
              </div>
              <button
                type="button"
                className="chat-panel-close"
                onClick={() => onClose('button')}
                aria-label="Close chat"
              >
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="chat-panel-body">
              {/* Placeholder welcome bubble — replaced in PR-2 by a
                  real Claude system-prompted greeting that streams. */}
              <div className="chat-msg chat-msg-assistant">
                <p>
                  Hi! I&rsquo;m a sleep assistant — ask me anything about mattresses, brands,
                  firmness, or what fits your sleeping style. I&rsquo;m almost ready to help.
                </p>
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  Full chat with product recommendations and showroom Q&amp;A launches shortly.
                  Try the <a href="/sleep-quiz">2-minute sleep quiz</a> in the meantime — same
                  matching logic, just guided.
                </p>
              </div>

              <div className="chat-suggestions" aria-label="Example questions">
                <p className="chat-suggestions-eyebrow muted">When I&rsquo;m live, you&rsquo;ll be able to ask…</p>
                <ul role="list">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <li key={p} role="listitem" className="chat-suggestion-pill">{p}</li>
                  ))}
                </ul>
              </div>
            </div>

            <footer className="chat-panel-foot">
              {/* Input is intentionally inert in PR-1. The placeholder
                  text is the disclosure — no fake echoes, no "thinking"
                  spinner that goes nowhere. Real input wires up in PR-2. */}
              <div className="chat-input-wrap">
                <textarea
                  className="chat-input"
                  placeholder="Chat input coming soon — try the sleep quiz for now"
                  rows={1}
                  disabled
                  aria-label="Chat input (coming soon)"
                />
                <button type="button" className="chat-send" disabled aria-label="Send (coming soon)">
                  <Icon name="arrow-right" size={16} />
                </button>
              </div>
              <p className="chat-foot-disclosure muted">
                AI responses can be inaccurate. Verify pricing &amp; availability in cart.
              </p>
            </footer>
          </aside>
        </>
      ) : null}
    </>
  );
}
