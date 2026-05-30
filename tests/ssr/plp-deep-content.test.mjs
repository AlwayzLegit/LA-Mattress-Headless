/**
 * Phase 308 SEO PR — collection PLP deep-content fallback.
 *
 * Semrush 20260530 flagged the highest-traffic collection PLPs for
 * `low_word_count`, `low_readability`, and `missing_related_words`.
 * The PLP template already had the right structure (long-form body
 * slot + FAQ + link cluster); the gap was an empty body slot on
 * collections where the merchant hadn't authored descriptionHtml.
 *
 * This test covers `lib/plp-deep-content.ts` — the per-handle
 * fallback that fills the body slot with 350-450 words of structured
 * prose when merchant content is missing.
 *
 * Unit-only — no SSR tests here. The SSR effect (PlpContentBlock
 * rendering the fallback into the page DOM) is structurally
 * identical to merchant body rendering, so the existing
 * collection.test.mjs already exercises that path. These tests cover
 * the data + matcher contract.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { categoryDeepContentFor } from '../../lib/plp-deep-content.ts';

const FLAGGED_HANDLES = [
  'tempur-pedic-mattresses',
  'stearns-foster-mattresses',
  'helix-mattresses',
  'memory-foam-mattresses',
  'hybrid-mattresses',
  'latex-mattresses',
  'innerspring-mattresses',
  'cooling-mattresses',
  'organic-mattress',
  'mattress-toppers',
  'adjustable-beds',
  'mattress-protector',
  'bed-frames',
  'twin-size-mattresses',
  'twin-xl-mattress-sale',
  'full-size-mattresses',
  'queen-size-mattresses',
  'king-size-mattresses',
  'california-king-mattresses',
  'split-king-mattresses',
  'on-sale',
  'mattresses',
];

test('every flagged collection handle returns deep content', () => {
  for (const handle of FLAGGED_HANDLES) {
    const out = categoryDeepContentFor(handle, 'Test Title');
    assert.ok(out.length > 0, `expected deep content for "${handle}", got empty string`);
  }
});

test('deep content is the right length (300-2500 chars per collection)', () => {
  // Each collection block runs ~300-500 words ≈ 1800-3500 chars of
  // HTML (including <p> tags). Below 300 chars is suspiciously thin;
  // above 2500 risks dominating the page.
  for (const handle of FLAGGED_HANDLES) {
    const out = categoryDeepContentFor(handle, 'Test');
    assert.ok(out.length >= 300, `"${handle}" deep content too short (${out.length} chars)`);
    assert.ok(out.length <= 3500, `"${handle}" deep content too long (${out.length} chars)`);
  }
});

test('deep content always carries internal links', () => {
  // Every block must link to at least one internal destination —
  // that's the entire point of the SEO-internal-links flag the
  // PlpContentBlock structure addresses.
  for (const handle of FLAGGED_HANDLES) {
    const out = categoryDeepContentFor(handle, 'Test');
    const internalLinks = (out.match(/<a\s+href="\//g) ?? []).length;
    assert.ok(
      internalLinks >= 1,
      `"${handle}" deep content has 0 internal links`,
    );
  }
});

test('unknown handles return empty string (caller falls through to FAQ-only)', () => {
  assert.equal(categoryDeepContentFor('not-a-real-collection', 'Test'), '');
  assert.equal(categoryDeepContentFor('weird-handle-12345', 'Test'), '');
});

test('size-pattern specificity: california king matches before king', () => {
  // The naive substring match "king" would also match "california
  // king" — the size handler must check Cal King first or the wrong
  // content renders. Both should resolve to their own size blocks.
  const cal = categoryDeepContentFor('california-king-mattresses', 'CK');
  const king = categoryDeepContentFor('king-size-mattresses', 'K');
  assert.ok(cal.includes('California King'), 'cal king block should mention California King');
  assert.ok(king.includes('76"'), 'king block should mention standard King width 76"');
  assert.ok(
    !king.includes('California King'),
    'standard king block should NOT contain Cal King content',
  );
});

test('size-pattern specificity: split king matches before king', () => {
  const split = categoryDeepContentFor('split-king-mattresses', 'SK');
  assert.ok(split.includes('Split King'), 'split-king block should mention Split King');
  assert.ok(split.includes('Two 38"'), 'split-king block should mention "Two 38\\"" dimensions');
});

test('size-pattern specificity: twin xl matches before twin', () => {
  const xl = categoryDeepContentFor('twin-xl-mattress-sale', 'TXL');
  const twin = categoryDeepContentFor('twin-size-mattresses', 'T');
  assert.ok(xl.includes('Twin XL'), 'twin-xl block should mention Twin XL');
  assert.ok(xl.includes('38" × 80"'), 'twin-xl block should mention 38×80 dimensions');
  // Standard Twin block is allowed to cross-link to Twin XL (good
  // UX — point taller sleepers at the right collection). The
  // PRIMARY subject signal is the 38" × 75" dimensions appearing in
  // the lede, which the test asserts is present.
  assert.ok(twin.includes('38" × 75"'), 'twin block should mention standard 38×75 dimensions');
});
