/**
 * Unit tests for unwrapDeadExternalLinks in lib/sanitize.ts — the render-
 * time pass that drops anchors to confirmed-dead external URLs (permanent
 * 404s) while preserving their visible text. Targets SEMrush "Broken
 * external links" warning 12 for the genuinely-dead competitor-blog link,
 * leaving live citations (incl. ones that transiently 429/503 to the
 * crawler) untouched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { unwrapDeadExternalLinks, sanitizeShopifyHtml } = await import('../../lib/sanitize.ts');

test('unwraps the dead mattressland link, keeps the text', () => {
  const html = '<p>See <a href="https://mattressland.com/blog/allergy-symptoms">allergy symptoms</a> for more.</p>';
  assert.equal(unwrapDeadExternalLinks(html), '<p>See allergy symptoms for more.</p>');
});

test('matches regardless of protocol / query string', () => {
  const html = '<p><a href="http://mattressland.com/blog/allergy-symptoms?ref=x">x</a></p>';
  assert.equal(unwrapDeadExternalLinks(html), '<p>x</p>');
});

test('leaves live external links untouched', () => {
  const html = '<p><a href="https://www.sleepfoundation.org/mattress-information">source</a></p>';
  assert.equal(unwrapDeadExternalLinks(html), html);
});

test('full sanitize pipeline strips the dead link but keeps the prose', () => {
  const out = sanitizeShopifyHtml('<p>Read about <a href="https://mattressland.com/blog/allergy-symptoms">allergies</a>.</p>');
  assert.ok(!/mattressland\.com/.test(out), out);
  assert.ok(/allergies/.test(out), out);
});
