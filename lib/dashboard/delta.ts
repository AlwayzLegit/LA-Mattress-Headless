/**
 * Pure delta-formatting helpers used by the dashboard's KPI cards.
 *
 * Two flavors:
 *   - formatRelativeDelta: relative percent change (X went from 100 → 120 = +20.0%)
 *     Used for absolute counts and dollar values where "relative" is the
 *     natural unit.
 *   - formatRateDelta: percentage-point change (rate went from 2.1% → 2.6% = +0.5pp)
 *     Used for already-fractional rates (conversion, abandonment, completion)
 *     where relative percent would be misleading on small numbers.
 *
 * Both return a tagged result the renderer can switch on:
 *   { kind: 'hidden' }           — don't render anything (current is null)
 *   { kind: 'no-comparison' }    — current is known but prev isn't; render
 *                                  a muted "—" so the user sees that the
 *                                  delta wasn't suppressed by a bug.
 *   { kind: 'new' }              — prev was 0 + current > 0; "new" callout
 *   { kind: 'no-change' }        — both zero; "no change"
 *   { kind: 'delta', ... }       — actual numeric delta with severity bucket
 *
 * Lives in lib/dashboard/ (vs inline in page.tsx) so the unit-test
 * suite can exercise the bucket boundaries without rendering React.
 */

export type DeltaSeverity = 'up' | 'down' | 'flat';

export type DeltaResult =
  | { kind: 'hidden' }
  | { kind: 'no-comparison' }
  | { kind: 'new' }
  | { kind: 'no-change' }
  | { kind: 'delta'; severity: DeltaSeverity; label: string };

/**
 * Format a relative percent change between two absolute values.
 *
 * Threshold: |Δ| < 0.5% renders as flat. Single-order swings on a
 * small base shouldn't read as a trend.
 *
 * Used by the Orders / Revenue / AVG-order KPI cards.
 */
export function formatRelativeDelta(current: number, prev: number | undefined | null): DeltaResult {
  if (prev === undefined || prev === null) return { kind: 'no-comparison' };
  if (prev === 0 && current === 0) return { kind: 'no-change' };
  if (prev === 0) return { kind: 'new' };
  const deltaPct = ((current - prev) / prev) * 100;
  const severity: DeltaSeverity = Math.abs(deltaPct) < 0.5 ? 'flat' : deltaPct > 0 ? 'up' : 'down';
  const sign = deltaPct > 0 ? '+' : '';
  return { kind: 'delta', severity, label: `${sign}${deltaPct.toFixed(1)}%` };
}

/**
 * Format a percentage-point change between two fractional rates.
 *
 * Threshold: |Δ| < 0.05pp renders as flat. Used by the conversion-rate
 * + completion-rate + abandonment-rate badges.
 *
 * Returns 'no-comparison' (not 'hidden') when prev is null but current
 * is known — the renderer shows "—" so the user sees the comparison
 * slot is intentionally empty (vs a missing badge that could be
 * mistaken for a regression).
 */
export function formatRateDelta(
  current: number | null,
  prev: number | null,
): DeltaResult {
  if (current === null) return { kind: 'hidden' };
  if (prev === null) return { kind: 'no-comparison' };
  const pp = (current - prev) * 100;
  const severity: DeltaSeverity = Math.abs(pp) < 0.05 ? 'flat' : pp > 0 ? 'up' : 'down';
  const sign = pp > 0 ? '+' : '';
  return { kind: 'delta', severity, label: `${sign}${pp.toFixed(2)} pp` };
}
