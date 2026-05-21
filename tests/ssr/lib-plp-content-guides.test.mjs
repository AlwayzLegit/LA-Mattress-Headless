/**
 * Unit tests for categoryGuidesFor() in lib/plp-content.ts.
 *
 * Locks down the SEMrush 20260521_1 follow-up that routes each orphan
 * collection to a specific set of buying-guide articles (so the orphan
 * collection PLPs surface contextual inbound links to the LA-local
 * pillar articles, pulling them out of the crawl-depth tail).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { categoryGuidesFor } = await import('../../lib/plp-content.ts');

/** All guides expose an `href` starting with `/blogs/` or `/pages/`. */
function assertGuideShape(guides) {
  for (const g of guides) {
    assert.ok(g.href, 'href required');
    assert.ok(g.label, 'label required');
    assert.match(g.href, /^\/(blogs|pages)\//, `href ${g.href} must be internal /blogs or /pages`);
  }
}

/* --- Orphan-specific routing (the new bit) -------------------------- */

test('best-sellers → LA-best pillar + size + cooling', () => {
  const guides = categoryGuidesFor('best-sellers');
  assert.equal(guides.length, 3);
  assertGuideShape(guides);
  assert.ok(guides.some((g) => g.href.includes('best-mattress-los-angeles')));
});

test('luxury-mattresses → LA-best + Purple-vs-Tempur + size', () => {
  const guides = categoryGuidesFor('luxury-mattresses');
  assert.equal(guides.length, 3);
  assertGuideShape(guides);
  assert.ok(guides.some((g) => g.href.includes('best-mattress-los-angeles')));
  assert.ok(guides.some((g) => g.href.includes('purple-mattress-vs-tempur-pedic')));
});

test('soft-mattresses-for-pressure-relief → back-pain + side-sleeper guides', () => {
  const guides = categoryGuidesFor('soft-mattresses-for-pressure-relief');
  assert.equal(guides.length, 3);
  assertGuideShape(guides);
  assert.ok(guides.some((g) => g.href.includes('best-mattress-for-back-pain')));
  assert.ok(guides.some((g) => g.href.includes('best-mattress-for-side-sleepers')));
});

test('tempur-pedic-adjustable-bases → adjustable-bed + financing guides', () => {
  const guides = categoryGuidesFor('tempur-pedic-adjustable-bases');
  assert.equal(guides.length, 3);
  assertGuideShape(guides);
  assert.ok(guides.some((g) => g.href.includes('adjustable-bed')));
  assert.ok(guides.some((g) => g.href.includes('mattress-financing-options-los-angeles')));
});

test('memorial-day-sale → LA-best + LA-financing + size', () => {
  const guides = categoryGuidesFor('memorial-day-sale');
  assert.equal(guides.length, 3);
  assertGuideShape(guides);
  assert.ok(guides.some((g) => g.href.includes('best-mattress-los-angeles')));
});

test('cooling-pillows → cooling + hypoallergenic', () => {
  const guides = categoryGuidesFor('cooling-pillows');
  assert.equal(guides.length, 2);
  assertGuideShape(guides);
});

/* --- Tempur-Pedic brand PLP (new specific routing) ------------------ */

test('tempur-pedic-mattresses → Purple-vs-Tempur comparison + LA-best', () => {
  const guides = categoryGuidesFor('tempur-pedic-mattresses');
  assertGuideShape(guides);
  assert.ok(guides.some((g) => g.href.includes('purple-mattress-vs-tempur-pedic')));
});

/* --- Adjustable PLPs always include the adjustable-bed guide ------- */

test('adjustable-beds → adjustable-bed health benefits + financing', () => {
  const guides = categoryGuidesFor('adjustable-beds');
  assertGuideShape(guides);
  assert.ok(guides.some((g) => g.href.includes('adjustable-bed')));
});

/* --- Regression: existing size routing still works ------------------ */

test('queen-size-mattresses still routes to queen guide cluster', () => {
  const guides = categoryGuidesFor('queen-size-mattresses');
  assert.ok(guides.length >= 3);
  assertGuideShape(guides);
  // The queen size guide article — unchanged from prior behavior.
  assert.ok(guides.some((g) => g.href.includes('queen-mattress-size-guide')));
});

test('california-king-mattresses still routes to cal-king guide cluster (before generic king)', () => {
  const guides = categoryGuidesFor('california-king-mattresses');
  assertGuideShape(guides);
  // The cal-king-specific comparison article must appear (not just
  // generic king-vs-cal).
  assert.ok(guides.some((g) => g.href.includes('california-king-vs-king-what-s-the-real-difference')));
});

/* --- Broad fallbacks ------------------------------------------------ */

test('broad commercial PLPs (e.g. on-sale) get the LA-best pillar too', () => {
  const guides = categoryGuidesFor('on-sale');
  assertGuideShape(guides);
  // Broad cluster now includes the LA pillar (was missing pre-batch).
  assert.ok(guides.some((g) => g.href.includes('best-mattress-los-angeles')));
});

test('non-matching collections return empty array', () => {
  // Hypothetical collection that doesn't match any pattern — guards
  // against accidental boilerplate that would link out from random PLPs.
  const guides = categoryGuidesFor('completely-unrelated-thing');
  assert.deepEqual(guides, []);
});
