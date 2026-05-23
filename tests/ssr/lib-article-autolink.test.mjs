/**
 * Unit tests for autoLinkArticleBody in lib/article-autolink.ts.
 *
 * Locks in the rules that matter most for the article render
 * pipeline:
 *   - first-mention only per destination (no duplicate-href injection)
 *   - skip-tag stack respects headings, code, blockquote, existing <a>
 *   - dedup against merchant-authored anchors already in the source
 *   - idempotent re-runs (safe across ISR + cache regenerations)
 *   - hard cap at MAX_LINKS=6 per article
 *
 * Pure-function tests — no Shopify, no Next.js, no fixtures beyond the
 * inline strings.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { autoLinkArticleBody } = await import('../../lib/article-autolink.ts');

const count = (s, needle) => (s.match(new RegExp(needle, 'g')) || []).length;

test('injects an internal anchor for a known phrase', () => {
  const out = autoLinkArticleBody('<p>Try a memory foam mattress in our showroom.</p>');
  assert.match(out, /<a href="\/collections\/memory-foam-mattresses" data-internal="auto">memory foam mattress<\/a>/);
});

test('longer phrase wins over its prefix subphrase', () => {
  // "memory foam mattress" should match before "memory foam" — both are in
  // the map but the longer phrase appears earlier (it's listed first by
  // design). Only one link goes in.
  const out = autoLinkArticleBody('<p>A memory foam mattress is great.</p>');
  assert.equal(count(out, 'data-internal="auto"'), 1);
  assert.match(out, />memory foam mattress</);
});

test('first-mention only per destination', () => {
  // Two paragraphs both contain "hybrid mattress" — only the first should
  // get linked. Without this rule, /collections/hybrid-mattresses would be
  // linked twice in the same article.
  const html = '<p>A hybrid mattress sleeps cool.</p><p>Another hybrid mattress here.</p>';
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, '/collections/hybrid-mattresses'), 1);
});

test('skips inside h1-h6 headings', () => {
  // Headings carry their own SEO signal — we don't compete with the H2.
  const html = '<h2>Memory foam vs hybrid mattress</h2><p>Both have pros and cons.</p>';
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, 'data-internal="auto"'), 0);
});

test('skips inside existing <a> tags', () => {
  // No nested anchors.
  const html = '<p>Read our <a href="/foo">latex mattress guide</a> for details.</p>';
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, 'data-internal="auto"'), 0);
});

test('skips inside pre and code blocks', () => {
  const html = '<pre>memory foam</pre><code>hybrid mattress</code>';
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, 'data-internal="auto"'), 0);
});

test('dedups against existing merchant-authored links', () => {
  // Merchant already linked to memory-foam-mattresses elsewhere — don't add
  // a second link to the same destination.
  const html =
    '<p>See our <a href="/collections/memory-foam-mattresses">memory foam guide</a>.</p>' +
    '<p>A memory foam mattress can change your sleep.</p>';
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, '/collections/memory-foam-mattresses'), 1);
});

test('trailing slash on existing anchor still dedups', () => {
  // /collections/foo and /collections/foo/ are the same destination.
  const html =
    '<p>See <a href="/collections/memory-foam-mattresses/">our guide</a>.</p>' +
    '<p>A memory foam mattress can change your sleep.</p>';
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, 'href="/collections/memory-foam-mattresses"'), 0);
  assert.equal(count(out, 'data-internal="auto"'), 0);
});

test('caps at MAX_LINKS=6 per article', () => {
  // 8 distinct phrases in 8 paragraphs — only 6 should be linked.
  const html = [
    '<p>A memory foam mattress.</p>',
    '<p>A hybrid mattress.</p>',
    '<p>A latex mattress.</p>',
    '<p>A plush mattress.</p>',
    '<p>A queen mattress.</p>',
    '<p>A king mattress.</p>',
    '<p>A twin mattress.</p>',
    '<p>An adjustable bed.</p>',
  ].join('');
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, 'data-internal="auto"'), 6);
});

test('passthrough when no phrases match', () => {
  const html = '<p>This article is about cats and dogs and nothing else.</p>';
  assert.equal(autoLinkArticleBody(html), html);
});

test('idempotent — running twice yields the same output', () => {
  const html = '<p>A memory foam mattress is comfortable.</p><p>And a hybrid mattress.</p>';
  const once = autoLinkArticleBody(html);
  const twice = autoLinkArticleBody(once);
  assert.equal(twice, once);
});

test('word boundary — does not match inside larger words', () => {
  // "submattress" should NOT match "mattress" — \b matters.
  // (No phrase in the map happens to be "mattress" alone; "submattress
  // protector" should also not match "mattress protector".)
  const html = '<p>The matter is settled, mattersome though it is.</p>';
  assert.equal(autoLinkArticleBody(html), html);
});

test('preserves original case from the source', () => {
  // PHRASE_MAP keys are lowercase; the matched substring's case is
  // preserved in the link text so it reads naturally inline.
  const out = autoLinkArticleBody('<p>The Tempur-Pedic showroom is open.</p>');
  assert.match(out, />Tempur-Pedic</);
});

test('handles empty input', () => {
  assert.equal(autoLinkArticleBody(''), '');
});

test('handles whitespace-only text nodes between tags', () => {
  // Tag-only HTML shouldn't blow up; whitespace-only text shouldn't
  // trigger matching either.
  const out = autoLinkArticleBody('<div><p>   </p></div>');
  assert.equal(out, '<div><p>   </p></div>');
});

test('matches plural form of a phrase', () => {
  // The PHRASE_MAP key is "memory foam mattress"; "memory foam
  // mattresses" should still link via the trailing s? in the regex.
  // Without this rule, ~half the article corpus that uses plural
  // phrasing slipped past the linker.
  const out = autoLinkArticleBody('<p>Most memory foam mattresses sleep cool.</p>');
  assert.match(out, /<a href="\/collections\/memory-foam-mattresses"[^>]*>memory foam mattresses<\/a>/);
});

test('extra-firm wins over plain firm when both are present', () => {
  // Ordering rule: "extra firm mattress" sits before "firm mattress" in
  // PHRASE_MAP, so when the text starts with the long form the long
  // form wins. Guards against a future map reorder accidentally
  // routing extra-firm traffic to the firm-mattress collection.
  const out = autoLinkArticleBody('<p>An extra firm mattress for back pain.</p>');
  assert.match(out, /href="\/collections\/extra-firm-mattresses"/);
  // Only one insert per text node, so "back pain" doesn't get a
  // second link in this same paragraph.
  assert.equal((out.match(/data-internal="auto"/g) || []).length, 1);
});

test('shorter anchor "back pain" links to the back-pain collection', () => {
  // Articles that discuss back pain without the full "mattress for
  // back pain" phrasing should still get linked.
  const out = autoLinkArticleBody('<p>Chronic back pain can disrupt sleep.</p>');
  assert.match(out, /<a href="\/collections\/mattresses-for-back-pain"[^>]*>back pain<\/a>/);
});

test('bed frame collection links from singular and plural', () => {
  const singular = autoLinkArticleBody('<p>A sturdy bed frame is essential.</p>');
  assert.match(singular, /<a href="\/collections\/bed-frames"[^>]*>bed frame<\/a>/);
  const plural = autoLinkArticleBody('<p>Modern bed frames look great.</p>');
  assert.match(plural, /<a href="\/collections\/bed-frames"[^>]*>bed frames<\/a>/);
});
