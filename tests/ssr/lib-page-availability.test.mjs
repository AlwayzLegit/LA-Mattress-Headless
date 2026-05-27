/**
 * Unit tests for lib/page-availability.ts — isPageAvailable(), the
 * pure predicate behind the sale-page date gate used by
 * lib/inventory.ts's publishedPages filter, app/sitemap.ts, and
 * generateStaticParams.
 *
 * Inlines a fixed `nowMs` argument so each test pins time without
 * touching the global Date.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { isPageAvailable } = await import('../../lib/page-availability.ts');

// 2026-06-01T00:00:00Z — fixed reference moment for all the date math
// below. Picked so that the Independence Day 2026 page (availableAt
// 2026-06-24T07:00:00Z) is still in the future.
const NOW = Date.parse('2026-06-01T00:00:00Z');

test('returns false when the page is unpublished, regardless of availableAt', () => {
  assert.equal(isPageAvailable({ isPublished: false }, NOW), false);
  assert.equal(isPageAvailable({ isPublished: false, availableAt: null }, NOW), false);
  assert.equal(isPageAvailable({ isPublished: false, availableAt: '2020-01-01T00:00:00Z' }, NOW), false);
});

test('returns true for published pages with no availableAt metafield (always-on CMS pages)', () => {
  assert.equal(isPageAvailable({ isPublished: true }, NOW), true);
  assert.equal(isPageAvailable({ isPublished: true, availableAt: null }, NOW), true);
  assert.equal(isPageAvailable({ isPublished: true, availableAt: undefined }, NOW), true);
});

test('returns true when availableAt is in the past', () => {
  assert.equal(isPageAvailable({ isPublished: true, availableAt: '2020-01-01T00:00:00Z' }, NOW), true);
});

test('returns true at the exact availableAt moment (>=, not >)', () => {
  // Boundary: a sale page goes live AT availableAt, not one ms after.
  assert.equal(isPageAvailable({ isPublished: true, availableAt: '2026-06-01T00:00:00Z' }, NOW), true);
});

test('returns false when availableAt is in the future', () => {
  // Real fixture: Independence Day 2026 page goes live 2026-06-24.
  assert.equal(isPageAvailable({ isPublished: true, availableAt: '2026-06-24T07:00:00Z' }, NOW), false);
  // Far-future sanity check.
  assert.equal(isPageAvailable({ isPublished: true, availableAt: '2099-12-31T00:00:00Z' }, NOW), false);
});

test('is permissive on malformed availableAt strings (treats as "no gate")', () => {
  // Better to render a sale page with a corrupt metafield than to
  // silently 404 it — a malformed string is more likely an
  // authoring typo than a real future date.
  assert.equal(isPageAvailable({ isPublished: true, availableAt: 'not-a-real-date' }, NOW), true);
  assert.equal(isPageAvailable({ isPublished: true, availableAt: '' }, NOW), true);
});

test('default nowMs argument reads Date.now() at call time', () => {
  // Without an explicit nowMs the predicate must still produce a
  // sensible result — covers the callsite in lib/inventory.ts which
  // doesn't pass time.
  assert.equal(isPageAvailable({ isPublished: true, availableAt: '2020-01-01T00:00:00Z' }), true);
  assert.equal(isPageAvailable({ isPublished: true, availableAt: '2099-12-31T00:00:00Z' }), false);
});
