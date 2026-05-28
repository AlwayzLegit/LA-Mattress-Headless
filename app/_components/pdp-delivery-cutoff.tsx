'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icon';

/**
 * Live same-day-delivery cutoff indicator for the PDP rail.
 *
 * Shows different messages depending on the current time in LA
 * (America/Los_Angeles, the merchant's timezone):
 *   - Before 4 PM weekday → "Order in 3h 27m for same-day LA delivery"
 *     (countdown to the 4 PM cutoff)
 *   - After 4 PM (or weekends) → "Order today for delivery tomorrow"
 *
 * Client-only render (hydration-safe pattern, same as
 * ShowroomOpenStatus): SSR emits nothing; client renders after mount
 * with the real wall-clock time so the time-dependent string doesn't
 * cause React #418 hydration warnings on ISR-cached pages.
 *
 * Re-evaluates every minute via setInterval so a shopper sitting on
 * the page sees the countdown decrement and the message flip at the
 * cutoff. setInterval is cheap (one timer per PDP, cleaned up on
 * unmount); cheaper than re-mounting the whole component on visibility
 * change.
 */

const CUTOFF_HOUR = 16; // 4 PM Los Angeles local

type State =
  | { kind: 'same-day'; hoursLeft: number; minutesLeft: number }
  | { kind: 'next-day' };

function computeState(now: Date): State {
  // Convert "now" to LA local time via Intl.DateTimeFormat. Reading
  // numeric parts is cheaper than constructing a new Date in a target
  // tz (which JS doesn't natively support).
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  if (hour >= CUTOFF_HOUR) return { kind: 'next-day' };
  const totalMinutesLeft = (CUTOFF_HOUR - hour) * 60 - minute;
  const hoursLeft = Math.floor(totalMinutesLeft / 60);
  const minutesLeft = totalMinutesLeft % 60;
  return { kind: 'same-day', hoursLeft, minutesLeft };
}

export function PdpDeliveryCutoff() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    setState(computeState(new Date()));
    const id = setInterval(() => setState(computeState(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!state) return null;

  if (state.kind === 'next-day') {
    return (
      <div className="pdp-delivery-cutoff pdp-delivery-cutoff-next">
        <Icon name="truck" size={14} />
        <span>
          <strong>Order today</strong> for free LA delivery tomorrow.
        </span>
      </div>
    );
  }

  // Format countdown: "3h 27m" / "47m" — drop the hour prefix when zero.
  const countdown =
    state.hoursLeft > 0
      ? `${state.hoursLeft}h ${state.minutesLeft}m`
      : `${state.minutesLeft}m`;

  return (
    <div className="pdp-delivery-cutoff pdp-delivery-cutoff-same">
      <Icon name="truck" size={14} />
      <span>
        Order in <strong className="tnum">{countdown}</strong> for{' '}
        <strong>same-day LA delivery</strong>.
      </span>
    </div>
  );
}
