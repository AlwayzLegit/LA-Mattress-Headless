/**
 * Unit tests for autoLinkArticleBody in lib/article-autolink.ts.
 *
 * Locks in the rules that matter most for the article render
 * pipeline:
 *   - first-mention only per destination (no duplicate-href injection)
 *   - skip-tag stack respects headings, code, blockquote, existing <a>
 *   - dedup against merchant-authored anchors already in the source
 *   - idempotent re-runs (safe across ISR + cache regenerations)
 *   - hard cap at MAX_LINKS=8 per article (bumped from 6 on 20260528)
 *   - safety-net fallback link appended only when zero internal
 *     links would otherwise ship (closes Semrush "no internal links
 *     in body" gap on orphan articles)
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

test('caps at MAX_LINKS=8 per article', () => {
  // 10 distinct phrases in 10 paragraphs — only 8 should be linked.
  // Bumped from 6 → 8 on 20260528 (see lib/article-autolink.ts).
  const html = [
    '<p>A memory foam mattress.</p>',
    '<p>A hybrid mattress.</p>',
    '<p>A latex mattress.</p>',
    '<p>A plush mattress.</p>',
    '<p>A queen mattress.</p>',
    '<p>A king mattress.</p>',
    '<p>A twin mattress.</p>',
    '<p>An adjustable bed.</p>',
    '<p>An organic mattress.</p>',
    '<p>A cooling mattress.</p>',
  ].join('');
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, 'data-internal="auto"'), 8);
});

test('passthrough (modulo fallback) when no phrases match', () => {
  // No PHRASE_MAP entry matches → fallback paragraph appended so the
  // article still ships at least one internal link in the body.
  const html = '<p>This article is about cats and dogs and nothing else.</p>';
  const out = autoLinkArticleBody(html);
  assert.ok(out.startsWith(html), 'original HTML preserved verbatim');
  assert.match(out, /data-internal="auto-fallback"/, 'fallback link appended');
  assert.equal(count(out, '<a href="'), 1, 'exactly one link (the fallback)');
});

test('does NOT append fallback when at least one PHRASE_MAP match was found', () => {
  const out = autoLinkArticleBody('<p>Try a memory foam mattress.</p>');
  assert.equal(count(out, 'data-internal="auto-fallback"'), 0);
  assert.equal(count(out, 'data-internal="auto"'), 1);
});

test('does NOT append fallback when the merchant pre-linked an internal URL', () => {
  // Pre-linked article body, no PHRASE_MAP-matchable text, hand-link to
  // an internal destination → fallback should NOT fire.
  const html = '<p>Read <a href="/pages/showrooms">our showroom guide</a>.</p>';
  const out = autoLinkArticleBody(html);
  assert.equal(count(out, 'data-internal="auto-fallback"'), 0);
  assert.equal(count(out, '<a href="'), 1, 'merchant link preserved, no fallback added');
});

test('orphan-article topical clusters now get a PHRASE_MAP link', () => {
  // Topic snippets sampled from the 33 orphan blog articles flagged in
  // the Semrush 20260528 ideas export. Each should now match SOMETHING
  // in PHRASE_MAP and ship a non-fallback internal link.
  // (Articles about "foam vs spring" intentionally fall through to the
  // fallback — see the "deliberately NOT added" comment in
  // lib/article-autolink.ts. The real such articles still get linked
  // via 'back pain' / 'memory foam' / etc. matches present in their
  // longer bodies.)
  const samples = [
    '<p>The Sealy vs Beautyrest question comes up a lot.</p>',
    '<p>Looking at a Serta mattress?</p>',
    '<p>An Avocado vs Tempur-Pedic comparison.</p>',
    '<p>An Intex air mattress is great for camping.</p>',
    '<p>If you have a bad back, the right mattress matters.</p>',
    '<p>A mattress cover protects against allergens.</p>',
    '<p>A kids mattress sizing primer.</p>',
  ];
  for (const html of samples) {
    const out = autoLinkArticleBody(html);
    assert.match(out, /data-internal="auto"(?!-fallback)/, `expected a PHRASE_MAP link in: ${html}`);
    assert.equal(count(out, 'data-internal="auto-fallback"'), 0, `should not need fallback: ${html}`);
  }
});

test('truly-orphan article body still gets the fallback link', () => {
  // Article body with no PHRASE_MAP-matchable text and no merchant
  // links — the safety-net fallback fires.
  const html = '<p>Sleep hygiene fundamentals: routine, light, temperature.</p>';
  const out = autoLinkArticleBody(html);
  assert.match(out, /<a href="\/collections\/mattresses" data-internal="auto-fallback">/);
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
  // With the 20260528 fallback in place, the autolinker still appends a
  // single /collections/mattresses fallback link when nothing matched,
  // so this assertion checks the original HTML is preserved verbatim
  // at the start of the output (no spurious word-boundary mid-match).
  const html = '<p>The matter is settled, mattersome though it is.</p>';
  const out = autoLinkArticleBody(html);
  assert.ok(out.startsWith(html));
  assert.equal(count(out, 'data-internal="auto"(?!-fallback)'), 0, 'no auto-PHRASE link injected');
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
  // trigger matching either. Fallback DOES append since no internal
  // link is present anywhere in the body — assert the original HTML
  // is preserved as a prefix and the only added link is the fallback.
  const html = '<div><p>   </p></div>';
  const out = autoLinkArticleBody(html);
  assert.ok(out.startsWith(html));
  assert.equal(count(out, 'data-internal="auto-fallback"'), 1);
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

test('selfHref prevents the body linking back to its own page (#8)', () => {
  // On /collections/memory-foam-mattresses, "memory foam mattress" must
  // NOT self-link; the budget should go to the *related* collection
  // ("latex mattress") the same prose mentions.
  const body = '<p>Our memory foam mattress lineup rivals any latex mattress.</p>';
  const out = autoLinkArticleBody(body, '/collections/memory-foam-mattresses');
  assert.doesNotMatch(out, /<a href="\/collections\/memory-foam-mattresses"/);
  assert.match(out, /<a href="\/collections\/latex-mattresses"[^>]*>latex mattress<\/a>/);
});

test('selfHref normalizes a trailing slash', () => {
  const out = autoLinkArticleBody('<p>A great memory foam mattress.</p>', '/collections/memory-foam-mattresses/');
  assert.doesNotMatch(out, /<a href="\/collections\/memory-foam-mattresses"/);
});

test('no selfHref keeps the original self-linking behavior for articles', () => {
  const out = autoLinkArticleBody('<p>A great memory foam mattress.</p>');
  assert.match(out, /<a href="\/collections\/memory-foam-mattresses"/);
});
