/**
 * Unit tests for lib/brand-story.ts — the per-vendor brand-story lookup
 * that powers the PDP brand band (Round 13, SEMrush issue 223).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { brandStoryFor } = await import('../../lib/brand-story.ts');

test('brandStoryFor: Diamond resolves with matching signature', () => {
  const s = brandStoryFor('Diamond');
  assert.ok(s, 'expected a Diamond story');
  assert.equal(s.vendor, 'Diamond');
  // The signature must be a substring of the paragraph so the component
  // and the strip script agree on the migration transition.
  assert.ok(s.paragraph.includes(s.signature), 'signature must be inside the paragraph');
  assert.match(s.heading, /Diamond/);
});

test('brandStoryFor: Helix Sleep resolves with matching signature', () => {
  const s = brandStoryFor('Helix Sleep');
  assert.ok(s, 'expected a Helix story');
  assert.equal(s.vendor, 'Helix Sleep');
  assert.ok(s.paragraph.includes(s.signature), 'signature must be inside the paragraph');
});

test('brandStoryFor: unknown vendor returns null', () => {
  assert.equal(brandStoryFor('Tempur-Pedic'), null);
  assert.equal(brandStoryFor('Stearns & Foster'), null);
});

test('brandStoryFor: null/empty vendor returns null (no throw)', () => {
  assert.equal(brandStoryFor(null), null);
  assert.equal(brandStoryFor(undefined), null);
  assert.equal(brandStoryFor(''), null);
});
