/**
 * Guards LOCATIONS_FAQ (lib/locations-faq.ts) — rendered on
 * /pages/mattress-store-locations with FAQPage JSON-LD. Phase: near-me
 * on-page tuning (SEMrush Ideas 20260618, /pages/mattress-store-locations
 * priority 1244 for "mattress stores near me"). Pure lib import.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { LOCATIONS_FAQ } = await import('../../lib/locations-faq.ts');

test('every FAQ item is well-formed', () => {
  assert.ok(LOCATIONS_FAQ.length > 0);
  for (const it of LOCATIONS_FAQ) {
    assert.ok(it.q.trim().length > 0, 'question non-empty');
    assert.ok(it.a.trim().length >= 40, 'answer in the rich-snippet band');
    if (it.link) assert.match(it.link.href, /^\//, 'link href is internal');
  }
});

test('targets the "near me" head term in a question', () => {
  assert.ok(
    LOCATIONS_FAQ.some((it) => /near me/i.test(it.q)),
    'expected a question targeting "near me" intent',
  );
});

test('question set is unique', () => {
  const qs = LOCATIONS_FAQ.map((it) => it.q);
  assert.equal(new Set(qs).size, qs.length, 'duplicate FAQ question');
});
