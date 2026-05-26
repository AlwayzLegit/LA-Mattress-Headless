'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { track } from '@/lib/analytics';

/**
 * Floating quiz CTA — always-visible after a small scroll on storefront
 * routes that don't host the quiz itself or a competing checkout flow.
 *
 * Industry-standard pattern (Helix, Casper, Saatva, Purple, Nectar all
 * ship a variant of this): the sleep quiz is the highest-converting
 * discovery surface for mattress retailers, but every site hides it
 * behind nav dropdowns and body-copy links unless they put a persistent
 * shortcut on every page. The pill below is that shortcut.
 *
 * Behavioural choices:
 *   - Hidden above 200px scroll so the hero is unobstructed on first paint.
 *   - Auto-hidden on /sleep-quiz (don't promote the page from itself),
 *     /cart + /compare (competes with their own bottom-fixed UI),
 *     /admin + /account (intrusive in transactional / personal flows).
 *   - Dismissable for the browser session via sessionStorage — if a
 *     shopper rejects it once we respect that for the visit instead of
 *     re-popping on every route change.
 *   - Mobile: collapses to icon-only circular pill (≤480px) so it doesn't
 *     compete with thumb-reach areas or system gesture zones.
 *   - Analytics: fires `quiz_fab_clicked` + `quiz_fab_dismissed` so we
 *     can measure incremental contribution on top of the existing 19
 *     in-content quiz links.
 */
const DISMISS_KEY = 'la-mattress.quiz-fab.dismissed.v1';
const SHOW_SCROLL_PX = 200;

const HIDDEN_PREFIXES = [
  '/sleep-quiz',
  '/cart',
  '/compare',
  '/admin',
  '/account',
];

function isHidden(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function QuizFab() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
      }
    } catch { /* sessionStorage disabled — fall through, FAB stays alive */ }
  }, []);

  useEffect(() => {
    if (dismissed || isHidden(pathname)) {
      setVisible(false);
      return;
    }
    let pending = false;
    const update = () => {
      setVisible(window.scrollY > SHOW_SCROLL_PX);
      pending = false;
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname, dismissed]);

  if (dismissed || isHidden(pathname)) return null;

  const onDismiss = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try { window.sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
    track('quiz_fab_dismissed', { pathname });
  };

  const onClick = () => {
    track('quiz_fab_clicked', { pathname });
  };

  return (
    <div
      className={`quiz-fab${visible ? ' is-visible' : ''}`}
      aria-hidden={!visible}
    >
      <Link
        href="/sleep-quiz"
        className="quiz-fab-link"
        onClick={onClick}
        tabIndex={visible ? 0 : -1}
        aria-label="Find your mattress with our 2-minute sleep quiz"
      >
        <span className="quiz-fab-icon" aria-hidden="true">
          <Icon name="bed" size={18} />
        </span>
        <span className="quiz-fab-label">
          <span className="quiz-fab-eyebrow">2-min quiz</span>
          <span className="quiz-fab-title">Find your mattress</span>
        </span>
        <span className="quiz-fab-arrow" aria-hidden="true">
          <Icon name="arrow-right" size={14} />
        </span>
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        className="quiz-fab-dismiss"
        aria-label="Dismiss the quiz suggestion for this visit"
        tabIndex={visible ? 0 : -1}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
