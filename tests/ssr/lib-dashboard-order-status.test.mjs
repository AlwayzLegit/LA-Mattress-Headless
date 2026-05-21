/**
 * Unit tests for lib/dashboard/order-status.ts.
 *
 * The order detail page (/admin/orders/[id]) uses badgeColor +
 * humanize to render Shopify enum values as pills + sentence-cased
 * labels. Both are tiny but they're the kind of helpers that quietly
 * drift when new statuses appear in the Shopify API.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { badgeColor, humanize } = await import('../../lib/dashboard/order-status.ts');

/* --- badgeColor --------------------------------------------------------- */

test('badgeColor: PAID + FULFILLED + AUTHORIZED all map to green', () => {
  assert.equal(badgeColor('PAID'), 'green');
  assert.equal(badgeColor('FULFILLED'), 'green');
  assert.equal(badgeColor('AUTHORIZED'), 'green');
});

test('badgeColor: in-progress statuses map to warn', () => {
  assert.equal(badgeColor('PENDING'), 'warn');
  assert.equal(badgeColor('IN_PROGRESS'), 'warn');
  assert.equal(badgeColor('PARTIALLY_FULFILLED'), 'warn');
  assert.equal(badgeColor('PARTIALLY_PAID'), 'warn');
});

test('badgeColor: refund / void / unfulfilled map to critical', () => {
  assert.equal(badgeColor('REFUNDED'), 'critical');
  assert.equal(badgeColor('PARTIALLY_REFUNDED'), 'critical');
  assert.equal(badgeColor('VOIDED'), 'critical');
  assert.equal(badgeColor('UNFULFILLED'), 'critical');
});

test('badgeColor: case-insensitive (defensive against API drift)', () => {
  // Shopify GraphQL returns uppercase enums today; the function should
  // still classify lowercase inputs correctly so a future schema
  // change doesn't render every order badge as "neutral".
  assert.equal(badgeColor('paid'), 'green');
  assert.equal(badgeColor('Partially_Refunded'), 'critical');
});

test('badgeColor: unknown status falls through to neutral', () => {
  assert.equal(badgeColor('NEW_STATUS_FROM_FUTURE'), 'neutral');
  assert.equal(badgeColor(''), 'neutral');
  assert.equal(badgeColor('????'), 'neutral');
});

/* --- humanize ----------------------------------------------------------- */

test('humanize: PARTIALLY_REFUNDED → "Partially refunded"', () => {
  assert.equal(humanize('PARTIALLY_REFUNDED'), 'Partially refunded');
});

test('humanize: single-word enum → sentence-cased', () => {
  assert.equal(humanize('PAID'), 'Paid');
  assert.equal(humanize('REFUNDED'), 'Refunded');
});

test('humanize: handles already-lowercased input', () => {
  assert.equal(humanize('partially_paid'), 'Partially paid');
});

test('humanize: collapses runs of underscores', () => {
  // Defensive — Shopify enums never have double underscores today,
  // but if one ever sneaks in, the helper should silently dedupe.
  assert.equal(humanize('IN__PROGRESS'), 'In progress');
});

test('humanize: empty string returns empty string', () => {
  assert.equal(humanize(''), '');
});

test('humanize: only the first word gets capitalized (sentence case)', () => {
  // "Partially refunded" not "Partially Refunded" — the design wants a
  // sentence feel, not title case.
  const out = humanize('IN_PROGRESS_NOW');
  assert.equal(out, 'In progress now');
});
