'use client';

import Link from 'next/link';
import { Icon, type IconName } from '../icon';
import { openChat } from '@/lib/chat/chat-events';
import { track } from '@/lib/analytics';

/**
 * Homepage section — "Three ways to find your match". Replaces the
 * previous QuizTeaser, which repeated the same quiz CTA already
 * surfaced above the fold (in the QuizLeadIn) and a third time in the
 * primary nav. Industry-standard pattern adopted by Helix, Saatva,
 * DreamCloud: present the discovery paths side-by-side and let the
 * shopper pick the format that fits their decision style.
 *
 * Three cards:
 *   - Take the 2-min sleep quiz (algorithm-driven match)
 *   - Chat with our AI sleep assistant (open-ended Q&A → opens the
 *     floating chat panel via the cross-component event channel)
 *   - Visit an LA showroom (try in person — store locator)
 *
 * Card 2 is the only entry point that opens chat from outside the
 * widget itself. We dispatch CHAT_OPEN_EVENT so callers don't need a
 * ref or context to reach into <ChatWidget />'s state. See
 * lib/chat/chat-events.ts for the contract.
 *
 * Client component because card 2 needs onClick → window dispatch.
 * The other two cards could be server-rendered, but co-locating keeps
 * the visual styling consistent without two separate components.
 */

type WayCard = {
  eyebrow: string;
  title: string;
  body: string;
  icon: IconName;
  cta: string;
} & (
  | { kind: 'link'; href: string; }
  | { kind: 'chat'; }
);

const WAYS: WayCard[] = [
  {
    kind: 'link',
    eyebrow: '2 minutes',
    title: 'Take the sleep quiz',
    body: 'Eight short questions. We narrow 200+ models down to the three best matched to how you actually sleep.',
    icon: 'bed',
    cta: 'Start the quiz',
    href: '/sleep-quiz',
  },
  {
    kind: 'chat',
    eyebrow: 'Ask anything',
    title: 'Chat with a sleep expert',
    body: 'Powered by Claude. Get a real recommendation for back pain, hot sleepers, side sleepers — anything in plain English.',
    icon: 'chat',
    cta: 'Open chat',
  },
  {
    kind: 'link',
    eyebrow: 'Try in person',
    title: 'Visit an LA showroom',
    body: 'Five showrooms across Los Angeles. Lying on three mattresses for ten minutes each beats any spec sheet.',
    icon: 'pin',
    cta: 'Find a showroom',
    href: '/pages/mattress-store-locations',
  },
];

export function WaysToFindMatch() {
  const onChatClick = () => {
    openChat();
    track('chat_opened', { pathname: '/' });
  };

  return (
    <section className="ways-section" aria-labelledby="ways-h">
      <div className="container">
        <header className="ways-head">
          <div className="eyebrow">Find your match</div>
          <h2 id="ways-h" className="h2 ways-title">Three ways to pick the right mattress.</h2>
          <p className="muted ways-lede">
            Different shoppers, different decision styles. Pick whichever feels right —
            you can always switch between them.
          </p>
        </header>

        <div className="ways-grid" role="list">
          {WAYS.map((w) => {
            const body = (
              <>
                <div className="ways-card-icon" aria-hidden="true">
                  <Icon name={w.icon} size={22} />
                </div>
                <div className="ways-card-meta">
                  <div className="eyebrow ways-card-eyebrow">{w.eyebrow}</div>
                  <h3 className="ways-card-title">{w.title}</h3>
                  <p className="ways-card-body muted">{w.body}</p>
                  <span className="ways-card-cta">
                    {w.cta} <Icon name="arrow-right" size={14} />
                  </span>
                </div>
              </>
            );
            if (w.kind === 'chat') {
              return (
                <button
                  key={w.title}
                  role="listitem"
                  type="button"
                  className="ways-card ways-card-button"
                  onClick={onChatClick}
                  aria-label={`${w.title} — opens the AI shopping assistant`}
                >
                  {body}
                </button>
              );
            }
            return (
              <Link
                key={w.title}
                role="listitem"
                href={w.href}
                className="ways-card"
              >
                {body}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
