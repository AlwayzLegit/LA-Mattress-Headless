/**
 * Guards the curated LOCAL_GUIDES list (lib/local-guides.ts) rendered in
 * the "Local mattress guides" block on neighborhood pages (SEO plan
 * Phase 5). Pure lib import — no dev server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { LOCAL_GUIDES } = await import('../../lib/local-guides.ts');

test('every guide is a well-formed internal article link', () => {
  assert.ok(LOCAL_GUIDES.length > 0, 'expected at least one local guide');
  for (const g of LOCAL_GUIDES) {
    assert.match(g.href, /^\/blogs\/[a-z0-9/-]+$/, `href should be an internal /blogs path: ${g.href}`);
    assert.ok(g.title.trim().length > 0, 'title must be non-empty');
    assert.ok(g.blurb.trim().length > 0, 'blurb must be non-empty');
  }
});

test('guide hrefs are unique (no accidental duplicate links)', () => {
  const hrefs = LOCAL_GUIDES.map((g) => g.href);
  assert.equal(new Set(hrefs).size, hrefs.length, 'duplicate guide hrefs');
});
