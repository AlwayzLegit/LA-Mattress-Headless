/**
 * Unit tests for lib/dashboard/delta.ts — the bucket-and-format logic
 * behind the dashboard's DeltaBadge + RateDelta components.
 *
 * Locks down:
 *   - Threshold boundaries (0.5% relative, 0.05pp rate) so a future
 *     refactor doesn't silently shift them and turn real moves into
 *     "flat" or vice versa.
 *   - Edge cases the renderer assumes are tagged correctly:
 *     no-comparison (current known, prev null) — was QA #224 B2/B3,
 *     where the original code silently hid the badge.
 *     no-change (both zero) — for KPIs where flat = zero on both sides.
 *     new (prev zero, current > 0) — for "first orders this week" style.
 *   - Sign + rounding format so a tooltip a11y change doesn't break
 *     visual snapshots.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { formatRelativeDelta, formatRateDelta } = await import(
  '../../lib/dashboard/delta.ts'
);

/* --- formatRelativeDelta ------------------------------------------------ */

test('relative: returns no-comparison when prev is undefined', () => {
  assert.deepEqual(formatRelativeDelta(100, undefined), { kind: 'no-comparison' });
});

test('relative: returns no-comparison when prev is null', () => {
  assert.deepEqual(formatRelativeDelta(100, null), { kind: 'no-comparison' });
});

test('relative: no-change when both are 0', () => {
  assert.deepEqual(formatRelativeDelta(0, 0), { kind: 'no-change' });
});

test('relative: "new" when prev is 0 and current > 0', () => {
  assert.deepEqual(formatRelativeDelta(5, 0), { kind: 'new' });
});

test('relative: +20.0% up delta', () => {
  const r = formatRelativeDelta(120, 100);
  assert.equal(r.kind, 'delta');
  assert.equal(r.severity, 'up');
  assert.equal(r.label, '+20.0%');
});

test('relative: -25.0% down delta', () => {
  const r = formatRelativeDelta(75, 100);
  assert.equal(r.kind, 'delta');
  assert.equal(r.severity, 'down');
  assert.equal(r.label, '-25.0%');
});

test('relative: tiny change rounds to flat', () => {
  // 0.4% change is under the 0.5% noise band → flat.
  const r = formatRelativeDelta(100.4, 100);
  assert.equal(r.kind, 'delta');
  assert.equal(r.severity, 'flat');
  // Sign still positive in the label, just bucketed as flat.
  assert.equal(r.label, '+0.4%');
});

test('relative: exactly 0.5% is NOT flat (boundary)', () => {
  // The threshold uses < 0.5, so exactly 0.5 buckets as up.
  const r = formatRelativeDelta(100.5, 100);
  assert.equal(r.severity, 'up');
});

/* --- formatRateDelta ---------------------------------------------------- */

test('rate: returns hidden when current is null', () => {
  assert.deepEqual(formatRateDelta(null, 0.03), { kind: 'hidden' });
});

test('rate: returns no-comparison when current is known but prev is null', () => {
  // QA #224 B2/B3 — the original RateDelta returned null here, which
  // hid the badge entirely. The fix tags this case so the renderer
  // can show "—" instead.
  assert.deepEqual(formatRateDelta(0.03, null), { kind: 'no-comparison' });
});

test('rate: +0.5pp delta', () => {
  const r = formatRateDelta(0.026, 0.021);
  assert.equal(r.kind, 'delta');
  assert.equal(r.severity, 'up');
  assert.equal(r.label, '+0.50 pp');
});

test('rate: -2.00pp delta (critical-level drop)', () => {
  const r = formatRateDelta(0.01, 0.03);
  assert.equal(r.severity, 'down');
  assert.equal(r.label, '-2.00 pp');
});

test('rate: tiny change under 0.05pp rounds to flat', () => {
  // 0.0003 fractional diff = 0.03pp, under the 0.05 threshold.
  const r = formatRateDelta(0.0203, 0.0200);
  assert.equal(r.severity, 'flat');
  // Label preserves the actual rounded value.
  assert.equal(r.label, '+0.03 pp');
});

test('rate: identical inputs are flat with 0.00 pp (no leading +)', () => {
  // Sign prefix is added only when pp > 0. Exact zero has neither
  // sign — reads cleaner than "+0.00 pp" which implies a tiny up.
  const r = formatRateDelta(0.03, 0.03);
  assert.equal(r.severity, 'flat');
  assert.equal(r.label, '0.00 pp');
});

test('rate: 100% → 0% is -100.00pp', () => {
  const r = formatRateDelta(0, 1);
  assert.equal(r.severity, 'down');
  assert.equal(r.label, '-100.00 pp');
});
