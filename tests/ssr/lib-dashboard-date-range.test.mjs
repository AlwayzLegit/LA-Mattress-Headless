/**
 * Unit tests for lib/dashboard/date-range.ts — the parsing,
 * preset-resolution, and URL round-tripping helpers behind the
 * admin dashboard's date-range picker.
 *
 * `now` is injected into every preset/custom call so each test pins a
 * specific moment without monkey-patching the global Date.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  DATE_RANGE_PRESETS,
  DEFAULT_PRESET,
  rangeFromPreset,
  rangeFromCustom,
  parseDateRange,
  parseCompareFlag,
  rangeToSearchParams,
  rangeToInputValues,
  previousRange,
} = await import('../../lib/dashboard/date-range.ts');

// 2026-05-27T19:00:00Z = 12 noon PT during PDT — well clear of any
// midnight boundary so date math is unambiguous.
const NOW = new Date('2026-05-27T19:00:00Z');

test('exports the 6 expected presets in stable order', () => {
  const keys = DATE_RANGE_PRESETS.map((p) => p.key);
  assert.deepEqual(keys, ['today', '7d', '30d', '90d', 'mtd', 'ytd']);
});

test('DEFAULT_PRESET is 30d', () => {
  assert.equal(DEFAULT_PRESET, '30d');
});

test('rangeFromPreset(today) spans one calendar day', () => {
  const r = rangeFromPreset('today', NOW);
  assert.equal(r.days, 1);
  assert.equal(r.isPreset, true);
  assert.equal(r.preset, 'today');
  assert.equal(r.label, 'Today');
});

test('rangeFromPreset(7d) spans 7 days including today', () => {
  const r = rangeFromPreset('7d', NOW);
  assert.equal(r.days, 7);
  assert.equal(r.preset, '7d');
});

test('rangeFromPreset(30d) spans 30 days', () => {
  const r = rangeFromPreset('30d', NOW);
  assert.equal(r.days, 30);
});

test('rangeFromPreset(90d) spans 90 days', () => {
  const r = rangeFromPreset('90d', NOW);
  assert.equal(r.days, 90);
});

test('rangeFromPreset(mtd) spans from the 1st of the LA-current month', () => {
  const r = rangeFromPreset('mtd', NOW);
  // May 1 → May 27 (inclusive) at noon = 27 days
  assert.equal(r.days, 27);
  assert.equal(r.label, 'Month to date');
});

test('rangeFromPreset(ytd) spans from Jan 1 of the LA-current year', () => {
  const r = rangeFromPreset('ytd', NOW);
  // Jan 1 → May 27 (inclusive) — 5 months + 27 days = 147 days in 2026
  // (non-leap), and the exclusive-tomorrow makes it 147. Allow ±1
  // day of slop for tz boundary edge.
  assert.ok(r.days >= 146 && r.days <= 148, `expected ~147 days, got ${r.days}`);
});

test('rangeFromCustom returns a non-preset range', () => {
  const r = rangeFromCustom('2026-05-01', '2026-05-10', NOW);
  assert.equal(r.isPreset, false);
  assert.equal(r.preset, null);
  // May 1 → May 10 inclusive = 10 days
  assert.equal(r.days, 10);
});

test('rangeFromCustom interprets the `to` arg as inclusive', () => {
  const r = rangeFromCustom('2026-05-01', '2026-05-01', NOW);
  assert.equal(r.days, 1);
});

test('rangeFromCustom falls back to DEFAULT_PRESET on bad input', () => {
  const bad = rangeFromCustom('not-a-date', 'also-bad', NOW);
  assert.equal(bad.preset, DEFAULT_PRESET);
});

test('rangeFromCustom rejects inverted ranges (to < from)', () => {
  const inverted = rangeFromCustom('2026-05-10', '2026-05-01', NOW);
  assert.equal(inverted.preset, DEFAULT_PRESET, 'must reject inverted span');
});

test('parseDateRange honours ?range= preset over ?from/?to', () => {
  const r = parseDateRange({ range: '7d' }, NOW);
  assert.equal(r.preset, '7d');
});

test('parseDateRange falls back to default when range is unknown', () => {
  const r = parseDateRange({ range: 'last-decade' }, NOW);
  assert.equal(r.preset, DEFAULT_PRESET);
});

test('parseDateRange honours ?from + ?to (both required) for custom span', () => {
  const r = parseDateRange({ from: '2026-05-01', to: '2026-05-10' }, NOW);
  assert.equal(r.isPreset, false);
  assert.equal(r.days, 10);
});

test('parseDateRange falls back to default when only one of from/to is supplied', () => {
  const r = parseDateRange({ from: '2026-05-01' }, NOW);
  assert.equal(r.preset, DEFAULT_PRESET);
});

test('parseDateRange returns default when no params present', () => {
  const r = parseDateRange({}, NOW);
  assert.equal(r.preset, DEFAULT_PRESET);
});

test('parseCompareFlag is true only on ?compare=1 or compare=true', () => {
  assert.equal(parseCompareFlag({ compare: '1' }), true);
  assert.equal(parseCompareFlag({ compare: 'true' }), true);
  assert.equal(parseCompareFlag({ compare: '0' }), false);
  assert.equal(parseCompareFlag({ compare: 'yes' }), false);
  assert.equal(parseCompareFlag({}), false);
});

test('rangeToSearchParams round-trips a preset', () => {
  const r = rangeFromPreset('7d', NOW);
  const sp = rangeToSearchParams(r);
  assert.equal(sp.get('range'), '7d');
  assert.equal(sp.get('from'), null);
});

test('rangeToSearchParams round-trips a custom span as from/to in YYYY-MM-DD', () => {
  const r = rangeFromCustom('2026-05-01', '2026-05-10', NOW);
  const sp = rangeToSearchParams(r);
  assert.equal(sp.get('range'), null);
  assert.equal(sp.get('from'), '2026-05-01');
  assert.equal(sp.get('to'), '2026-05-10');
});

test('rangeToSearchParams appends compare=1 when opts.compare is true', () => {
  const sp = rangeToSearchParams(rangeFromPreset('30d', NOW), { compare: true });
  assert.equal(sp.get('compare'), '1');
});

test('rangeToInputValues exposes YYYY-MM-DD strings for the date inputs', () => {
  const r = rangeFromCustom('2026-05-01', '2026-05-10', NOW);
  const v = rangeToInputValues(r);
  assert.equal(v.from, '2026-05-01');
  assert.equal(v.to, '2026-05-10');
});

test('previousRange is the immediately-preceding window of equal length', () => {
  const now = rangeFromCustom('2026-05-01', '2026-05-10', NOW);
  const prev = previousRange(now);
  assert.equal(prev.days, now.days);
  // Previous window's `to` equals the current window's `from`.
  assert.equal(prev.to, now.from);
});

test('full URL round-trip survives parseDateRange → rangeToSearchParams', () => {
  for (const preset of ['today', '7d', '30d', '90d', 'mtd', 'ytd']) {
    const r = parseDateRange({ range: preset }, NOW);
    const sp = rangeToSearchParams(r);
    assert.equal(sp.get('range'), preset);
  }
  const custom = parseDateRange({ from: '2026-05-01', to: '2026-05-10' }, NOW);
  const customSp = rangeToSearchParams(custom);
  assert.equal(customSp.get('from'), '2026-05-01');
  assert.equal(customSp.get('to'), '2026-05-10');
});
