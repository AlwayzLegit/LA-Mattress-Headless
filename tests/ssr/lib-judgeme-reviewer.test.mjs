/**
 * Unit tests for lib/judgeme.ts reviewer-name helpers.
 *
 * Locks down the #11 behaviour: a large share of this store's published
 * Judge.me reviews carry the literal reviewer name "Anonymous". These guard
 *   - reviewerName(): resolves across reviewer.name / first_name+last_name /
 *     top-level reviewer_name, with a fallback, and never throws on a null
 *     reviewer.
 *   - hasRealReviewerName(): treats empty and the literal "Anonymous"
 *     (any case) as NOT a real name, so the storefront can prefer
 *     attributable voices.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { reviewerName, hasRealReviewerName } = await import('../../lib/judgeme.ts');

const base = {
  id: 1, rating: 5, title: null, body: 'Great mattress',
  product_external_id: null, created_at: '2026-05-30T00:00:00Z', verified: true,
};

test('reviewerName reads reviewer.name', () => {
  assert.equal(reviewerName({ ...base, reviewer: { name: 'rosanna dicenso' } }), 'rosanna dicenso');
});

test('reviewerName joins first_name + last_name when name is empty', () => {
  assert.equal(reviewerName({ ...base, reviewer: { name: '', first_name: 'Ada', last_name: 'Lovelace' } }), 'Ada Lovelace');
});

test('reviewerName falls back to top-level reviewer_name', () => {
  assert.equal(reviewerName({ ...base, reviewer: null, reviewer_name: 'Grace H.' }), 'Grace H.');
});

test('reviewerName uses the provided fallback when every field is empty', () => {
  assert.equal(reviewerName({ ...base, reviewer: { name: '   ' } }), 'Verified customer');
  assert.equal(reviewerName({ ...base, reviewer: null }, 'Verified buyer'), 'Verified buyer');
});

test('reviewerName returns the literal "Anonymous" when that is the stored value', () => {
  // It is a real (if uninformative) stored value — resolver returns it as-is.
  assert.equal(reviewerName({ ...base, reviewer: { name: 'Anonymous' } }), 'Anonymous');
});

test('hasRealReviewerName: real names are real', () => {
  assert.equal(hasRealReviewerName({ ...base, reviewer: { name: 'rosanna dicenso' } }), true);
  assert.equal(hasRealReviewerName({ ...base, reviewer: { name: '', first_name: 'Ada' } }), true);
});

test('hasRealReviewerName: "Anonymous" (any case) and empty are NOT real', () => {
  assert.equal(hasRealReviewerName({ ...base, reviewer: { name: 'Anonymous' } }), false);
  assert.equal(hasRealReviewerName({ ...base, reviewer: { name: 'anonymous' } }), false);
  assert.equal(hasRealReviewerName({ ...base, reviewer: { name: 'ANONYMOUS' } }), false);
  assert.equal(hasRealReviewerName({ ...base, reviewer: { name: '' } }), false);
  assert.equal(hasRealReviewerName({ ...base, reviewer: null }), false);
});
