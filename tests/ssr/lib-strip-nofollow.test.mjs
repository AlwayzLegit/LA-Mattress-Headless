/**
 * Unit tests for lib/strip-nofollow.ts — the pure decision logic
 * powering both the server-side `sanitizeShopifyHtml` regex pass
 * and the client-side `StripInternalNofollow` MutationObserver
 * (SEMrush 20260521_1 follow-up).
 *
 * The helper takes an anchor's `href` + `rel` and returns the `rel`
 * value that should be set after stripping any internal-link nofollow
 * tokens. The caller decides what to do with the result (regex-replace
 * for server, setAttribute for client).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { isInternalHref, stripInternalNofollowFromRel } = await import(
  '../../lib/strip-nofollow.ts'
);

/* --- isInternalHref ---------------------------------------------------- */

test('isInternalHref: root-relative path is internal', () => {
  assert.equal(isInternalHref('/foo'), true);
  assert.equal(isInternalHref('/foo/bar?q=1#x'), true);
  assert.equal(isInternalHref('/'), true);
});

test('isInternalHref: in-page fragment is internal', () => {
  assert.equal(isInternalHref('#jdgm-write-review-form'), true);
  assert.equal(isInternalHref('#top'), true);
});

test('isInternalHref: protocol-relative // is external (not same-origin guaranteed)', () => {
  // //cdn.example.com/foo or //www.mattressstoreslosangeles.com/foo
  // — the browser will resolve protocol-relative to the current
  // origin's protocol, but the HOST varies. We treat as external
  // because the regex can't tell whether the host matches.
  assert.equal(isInternalHref('//cdn.example.com/foo'), false);
  assert.equal(isInternalHref('//www.mattressstoreslosangeles.com/foo'), false);
});

test('isInternalHref: absolute http(s) URL is external', () => {
  assert.equal(isInternalHref('https://judge.me/u/reviewer'), false);
  assert.equal(isInternalHref('http://example.com/'), false);
});

test('isInternalHref: empty / null / undefined are external (safe default)', () => {
  assert.equal(isInternalHref(''), false);
  assert.equal(isInternalHref(null), false);
  assert.equal(isInternalHref(undefined), false);
});

test('isInternalHref: mailto / tel / javascript URIs are external', () => {
  // These don't start with `/` or `#`, so the function correctly
  // classifies them as external. nofollow on mailto/tel is rare but
  // legitimate.
  assert.equal(isInternalHref('mailto:foo@bar.com'), false);
  assert.equal(isInternalHref('tel:+18005551234'), false);
  assert.equal(isInternalHref('javascript:void(0)'), false);
});

/* --- stripInternalNofollowFromRel ------------------------------------- */

test('strip: internal href + single nofollow → empty rel', () => {
  assert.equal(stripInternalNofollowFromRel('/foo', 'nofollow'), '');
});

test('strip: internal href + nofollow noopener → noopener remains', () => {
  // Judge.me commonly emits both — strip only the SEO-noise token.
  assert.equal(stripInternalNofollowFromRel('/foo', 'nofollow noopener'), 'noopener');
});

test('strip: internal href + noopener noreferrer nofollow → noopener noreferrer', () => {
  // Order-independent.
  assert.equal(
    stripInternalNofollowFromRel('/foo', 'noopener noreferrer nofollow'),
    'noopener noreferrer',
  );
});

test('strip: external href keeps nofollow (legitimate external use)', () => {
  // External nofollow is the canonical use case — left intact.
  assert.equal(
    stripInternalNofollowFromRel('https://judge.me/u/whatever', 'nofollow'),
    'nofollow',
  );
});

test('strip: in-page fragment is internal — nofollow gets stripped', () => {
  // The Judge.me "Write a Review" trigger is href="#jdgm-write-review-form".
  assert.equal(stripInternalNofollowFromRel('#jdgm-write-review-form', 'nofollow'), '');
});

test('strip: also drops sponsored + ugc tokens (SEMrush groups all three)', () => {
  assert.equal(stripInternalNofollowFromRel('/foo', 'nofollow sponsored ugc'), '');
  assert.equal(
    stripInternalNofollowFromRel('/foo', 'sponsored noopener'),
    'noopener',
  );
});

test('strip: case-insensitive token match', () => {
  // Some HTML serializers emit uppercase rel values.
  assert.equal(stripInternalNofollowFromRel('/foo', 'NOFOLLOW'), '');
  assert.equal(stripInternalNofollowFromRel('/foo', 'NoFollow Noopener'), 'Noopener');
});

test('strip: empty rel returns empty', () => {
  assert.equal(stripInternalNofollowFromRel('/foo', ''), '');
});

test('strip: rel without nofollow returns unchanged', () => {
  assert.equal(stripInternalNofollowFromRel('/foo', 'noopener'), 'noopener');
  assert.equal(stripInternalNofollowFromRel('/foo', 'noopener noreferrer'), 'noopener noreferrer');
});

test('strip: collapses runs of whitespace in input', () => {
  // Defensive: malformed input with extra spaces shouldn't produce
  // a result with hollow tokens.
  assert.equal(
    stripInternalNofollowFromRel('/foo', '  nofollow   noopener  '),
    'noopener',
  );
});

test('strip: idempotent — applying twice gives the same result', () => {
  const inputs = [
    ['/foo', 'nofollow noopener'],
    ['https://example.com/', 'nofollow'],
    ['#anchor', 'nofollow sponsored'],
    ['/', ''],
  ];
  for (const [href, rel] of inputs) {
    const once = stripInternalNofollowFromRel(href, rel);
    const twice = stripInternalNofollowFromRel(href, once);
    assert.equal(twice, once, `not idempotent for href=${href} rel=${rel}`);
  }
});
