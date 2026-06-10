/**
 * Unit tests for the parser-based XSS pass in sanitizeShopifyHtml
 * (lib/sanitize.ts, SANITIZE_CONFIG). The regex passes are content
 * repairs; THIS pass is the structural security boundary, so these
 * tests pin down exactly what must never survive (script, event
 * handlers, javascript: URLs, off-allowlist iframes) and what must
 * always survive (the merchant's presentation markup — Phase 229 says
 * YouTube/Vimeo embeds pass through by design).
 *
 * No dev server needed — pure lib import via Node 22 strip-types.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { sanitizeShopifyHtml } = await import('../../lib/sanitize.ts');

test('strips <script> tags AND their contents', () => {
  const out = sanitizeShopifyHtml('<p>before</p><script>alert("xss")</script><p>after</p>');
  assert.ok(!out.includes('<script'), 'script tag must be removed');
  assert.ok(!out.includes('alert'), 'script BODY must not leak as visible text');
  assert.ok(out.includes('before') && out.includes('after'), 'surrounding content survives');
});

test('strips event-handler attributes', () => {
  const out = sanitizeShopifyHtml('<img src="https://cdn.shopify.com/x.jpg" onerror="alert(1)" alt="bed">');
  assert.ok(!/onerror/i.test(out), 'onerror must be stripped');
  assert.ok(out.includes('alt="bed"'), 'legitimate attributes survive');
});

test('removes javascript: hrefs', () => {
  const out = sanitizeShopifyHtml('<a href="javascript:alert(1)">click</a>');
  assert.ok(!/javascript:/i.test(out), 'javascript: scheme must not survive');
  assert.ok(out.includes('click'), 'anchor text survives');
});

test('keeps relative, https, mailto and tel links', () => {
  const out = sanitizeShopifyHtml(
    '<a href="/pages/warranty">w</a><a href="https://example.com/x">x</a>' +
    '<a href="mailto:hi@example.com">m</a><a href="tel:+13231234567">t</a>',
  );
  assert.ok(out.includes('href="/pages/warranty"'));
  assert.ok(out.includes('href="https://example.com/x"'));
  assert.ok(out.includes('href="mailto:hi@example.com"'));
  assert.ok(out.includes('href="tel:+13231234567"'));
});

test('YouTube iframes pass through (Phase 229 contract)', () => {
  const out = sanitizeShopifyHtml(
    '<iframe src="https://www.youtube.com/embed/abc123" allowfullscreen></iframe>',
  );
  assert.ok(out.includes('youtube.com/embed/abc123'), 'YouTube embed must survive');
});

test('iframes from arbitrary hosts are stripped', () => {
  const out = sanitizeShopifyHtml('<iframe src="https://evil.example/steal"></iframe>');
  assert.ok(!out.includes('evil.example'), 'off-allowlist iframe must be removed');
});

test('Google Maps iframes still stripped wholesale (Phase 229)', () => {
  const out = sanitizeShopifyHtml(
    '<p>visit us</p><iframe src="https://maps.google.com/maps?q=LA"></iframe>',
  );
  assert.ok(!out.includes('<iframe'), 'merchant-pasted map iframe must be removed');
  assert.ok(out.includes('visit us'));
});

test('presentation markup survives: tables, headings, inline styles, data attrs', () => {
  const html =
    '<h2 id="sizes">Sizes</h2>' +
    '<table><tbody><tr><td colspan="2" style="text-align:center" data-row="1">Queen</td></tr></tbody></table>';
  const out = sanitizeShopifyHtml(html);
  assert.ok(out.includes('<h2 id="sizes">'));
  assert.ok(out.includes('colspan="2"'));
  assert.ok(out.includes('style="text-align:center"'), 'TinyMCE inline styles must survive');
  assert.ok(out.includes('data-row="1"'), 'data-* attributes must survive');
});

test('idempotent on already-clean content', () => {
  const clean = sanitizeShopifyHtml('<p>The <strong>Tempur-Pedic</strong> collection.</p>');
  assert.equal(sanitizeShopifyHtml(clean), clean);
});
