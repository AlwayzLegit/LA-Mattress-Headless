'use client';

import { useEffect, useState } from 'react';

const EVENT = 'la-mattress:announce';

/**
 * Imperative helper for components to announce a message to screen
 * readers. Fire-and-forget — no return value, no prop drilling, no
 * context required. The mounted <Announcer/> component listens for
 * the custom event and updates its visually-hidden aria-live region.
 *
 * Use cases:
 *   - "Added <product> to your cart"
 *   - "Saved <product>"
 *   - "Removed <product> from compare"
 *   - "Compare set is full (max 4)"
 *   - search empty / has-results state changes
 *
 * Safe to call before hydration — the event is dispatched into the
 * void if no listener is mounted yet, which is fine for the SSR pass.
 */
export function announce(message: string) {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

/**
 * Visually-hidden aria-live region. Mounted once in the root layout
 * so any component can call announce() without thinking about scope.
 *
 * Two regions stacked: one for polite messages (default — most
 * commerce actions), one for assertive (errors / blocking states).
 * The assertive channel is wired but not yet used; expose
 * `announceAssertive()` if a future flow needs it.
 *
 * Implementation note: each new message is appended with a leading
 * zero-width space when it matches the previous content. Otherwise
 * many SRs (NVDA, VoiceOver) deduplicate consecutive identical
 * announcements and stay silent on the second click. The ZWSP forces
 * a content-change without a visible diff.
 */
export function Announcer() {
  const [polite, setPolite] = useState('');

  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      if (typeof msg !== 'string' || !msg) return;
      setPolite((prev) => (prev === msg ? `​${msg}` : msg));
    };
    window.addEventListener(EVENT, onAnnounce);
    return () => window.removeEventListener(EVENT, onAnnounce);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {polite}
    </div>
  );
}
