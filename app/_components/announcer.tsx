'use client';

import { useEffect, useState } from 'react';

const EVENT_POLITE = 'la-mattress:announce';
const EVENT_ASSERTIVE = 'la-mattress:announce-assertive';

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

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
  window.dispatchEvent(new CustomEvent(EVENT_POLITE, { detail: message }));
}

/**
 * Same as announce(), but routes through the assertive aria-live
 * region. Use ONLY for genuine errors / blocking states where
 * interrupting the user's current SR output is justified — failed
 * cart adds, network errors, validation failures. Polite is the
 * default for every other flow because assertive interrupts what
 * the SR is currently reading and is overuse-fatiguing.
 */
export function announceAssertive(message: string) {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent(EVENT_ASSERTIVE, { detail: message }));
}

/**
 * Visually-hidden aria-live regions. Mounted once in the root layout
 * so any component can call announce() / announceAssertive() without
 * thinking about scope.
 *
 * Two channels:
 *   - polite (default): queues behind anything the SR is reading
 *   - assertive: interrupts; reserved for errors / blocking states
 *
 * Implementation note: each new message is appended with a leading
 * zero-width space when it matches the previous content. Otherwise
 * many SRs (NVDA, VoiceOver) deduplicate consecutive identical
 * announcements and stay silent on the second click. The ZWSP forces
 * a content-change without a visible diff.
 */
export function Announcer() {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  useEffect(() => {
    const dedup = (prev: string, msg: string) => (prev === msg ? `​${msg}` : msg);
    const onPolite = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      if (typeof msg !== 'string' || !msg) return;
      setPolite((prev) => dedup(prev, msg));
    };
    const onAssertive = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      if (typeof msg !== 'string' || !msg) return;
      setAssertive((prev) => dedup(prev, msg));
    };
    window.addEventListener(EVENT_POLITE, onPolite);
    window.addEventListener(EVENT_ASSERTIVE, onAssertive);
    return () => {
      window.removeEventListener(EVENT_POLITE, onPolite);
      window.removeEventListener(EVENT_ASSERTIVE, onAssertive);
    };
  }, []);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
        {polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" style={visuallyHidden}>
        {assertive}
      </div>
    </>
  );
}
