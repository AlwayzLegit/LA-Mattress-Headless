'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '../icon';
import { track } from '@/lib/analytics';
import { useFocusTrap } from '../use-focus-trap';
import { useBodyScrollLock } from '../use-body-scroll-lock';
import dynamic from 'next/dynamic';

// The conversation UI (~29KB source) only renders after the launcher is
// clicked — dynamic import keeps it out of every page's shared bundle
// (audit perf-js-09). No loading state needed: the panel opens with its
// own skeleton feel within the chunk fetch.
const ChatConversation = dynamic(
  () => import('./chat-conversation').then((m) => m.ChatConversation),
  { ssr: false },
);
import { CHAT_OPEN_EVENT } from '@/lib/chat/chat-events';

/**
 * Floating chat widget — the panel shell + open/close mechanics. PR-1
 * shipped the chrome; PR-2 wires in the live Claude conversation via
 * <ChatConversation />. PR-3 will add Storefront MCP tools (search,
 * cart, policy lookup).
 *
 * Positioning: bottom-right (industry default — Intercom, Drift, every
 * mainstream chat widget). z-90.
 *
 * Hidden on /admin and /account — chat in the admin dashboard makes
 * no sense, and shopper questions belong on shopping surfaces. Stays
 * visible on /sleep-quiz + /cart because the chat IS the assistant
 * that can answer mid-quiz / mid-cart questions.
 */
const HIDDEN_PREFIXES = ['/admin', '/account'];

function isHidden(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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

  // Listen for cross-component open requests — fired by the homepage
  // "Three ways to find your match" Chat card and (eventually) any
  // future entry point (cart empty state, exit intent, etc). The
  // dispatch helper lives in lib/chat/chat-events.ts so callers don't
  // have to know the event name. No-op when on a hidden route.
  useEffect(() => {
    if (isHidden(pathname)) return;
    const onOpenEvent = () => {
      setOpen(true);
      track('chat_opened', { pathname });
    };
    window.addEventListener(CHAT_OPEN_EVENT, onOpenEvent);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, onOpenEvent);
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

            {/* Body + footer (message list, input, streaming response
                handling) live in <ChatConversation />. Conditional
                mount via the `open` flag means a closed chat doesn't
                hold a streaming fetch or sessionStorage subscription. */}
            <ChatConversation />
          </aside>
        </>
      ) : null}
    </>
  );
}
