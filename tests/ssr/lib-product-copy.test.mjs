/**
 * Unit tests for buildProductAboutSentences (lib/product-copy.ts) — the
 * factual, spec-derived PDP body fallback rendered when a product has no
 * merchant-authored Shopify description (SEMrush issue 112, low
 * text-to-HTML on ~1,033 product URLs).
 *
 * Pure lib import via Node strip-types; product-copy.ts uses an
 * `import type` for the Product type, so nothing from lib/shopify loads
 * at runtime and a plain object stands in for the product.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildProductAboutSentences, htmlTextLength, isThinDescription, THIN_DESCRIPTION_CHARS, buildProductFaq } =
  await import('../../lib/product-copy.ts');

/** Minimal Product-shaped fixture; only the fields the builder reads. */
function makeProduct(over = {}) {
  return {
    title: 'Eclipse Glacier Tufted Firm Euro Top 15" Mattress',
    vendor: 'Eclipse',
    productType: 'Mattress',
    collections: [],
    specs: {
      heightInches: 15,
      firmness: 'Firm',
      materialType: 'Innerspring',
      warrantyYears: 10,
      trialNights: 120,
    },
    editorial: { firmnessScore: 8 },
    ...over,
  };
}

test('builds identity + feel + coverage from full specs', () => {
  const s = buildProductAboutSentences(makeProduct());
  assert.equal(s.length, 3);
  assert.match(s[0], /15-inch innerspring mattress/);
  assert.match(s[1], /firm feel \(8 out of 10/);
  assert.match(s[2], /10-year manufacturer warranty and our 120-night comfort exchange/);
});

test('drops the vendor clause when the title already names the brand', () => {
  const s = buildProductAboutSentences(makeProduct());
  assert.ok(!/from Eclipse/.test(s[0]), `vendor should not be repeated: ${s[0]}`);
});

test('adds the vendor clause when the title omits the brand', () => {
  const s = buildProductAboutSentences(
    makeProduct({ title: 'Glacier Tufted Firm Euro Top 15" Mattress' }),
  );
  assert.match(s[0], /from Eclipse\.$/);
});

test('falls back to productType when materialType is absent', () => {
  const s = buildProductAboutSentences(
    makeProduct({ specs: { heightInches: null, firmness: null, materialType: null, warrantyYears: null, trialNights: null }, productType: 'Adjustable Base' }),
  );
  assert.equal(s.length, 1);
  assert.match(s[0], /is a adjustable base mattress/);
});

test('omits the firmness score when editorial has none', () => {
  const s = buildProductAboutSentences(makeProduct({ editorial: { firmnessScore: null } }));
  assert.match(s[1], /firm feel\.$/);
  assert.ok(!/out of 10/.test(s[1]));
});

test('emits a single coverage clause when only one of warranty/trial is set', () => {
  const s = buildProductAboutSentences(
    makeProduct({ specs: { heightInches: 12, firmness: null, materialType: 'Memory Foam', warrantyYears: null, trialNights: 120 } }),
  );
  const coverage = s.find((x) => x.startsWith("It's backed by"));
  assert.equal(coverage, "It's backed by our 120-night comfort exchange.");
});

test('returns [] when there is nothing factual to say', () => {
  const s = buildProductAboutSentences(
    makeProduct({
      productType: '',
      specs: { heightInches: null, firmness: null, materialType: null, warrantyYears: null, trialNights: null },
    }),
  );
  // Identity always emits a generic "mattress" line — but with no
  // specs/type at all it should still be a single safe sentence, never empty chrome.
  assert.equal(s.length, 1);
  assert.match(s[0], /is a mattress/);
});

test('adds a construction sentence from editorial layers', () => {
  const s = buildProductAboutSentences(
    makeProduct({
      editorial: {
        firmnessScore: 8,
        layers: [{ name: 'Gel Memory Foam' }, { name: 'Transition Foam' }, { name: 'Pocketed Coils' }],
      },
    }),
  );
  const build = s.find((x) => x.startsWith('Its construction layers'));
  assert.ok(build, `expected a construction sentence: ${JSON.stringify(s)}`);
  assert.match(build, /gel memory foam, transition foam, and pocketed coils from top to bottom/);
});

test('names good-fit sleepers from the position grid', () => {
  const s = buildProductAboutSentences(
    makeProduct({
      editorial: { firmnessScore: 8, positionFit: { back: 'great', side: 'good', stomach: 'poor' } },
    }),
  );
  const fit = s.find((x) => x.startsWith("It's a good match for"));
  assert.equal(fit, "It's a good match for back and side sleepers.");
});

test('falls back to editorial bestFor when no position grid', () => {
  const s = buildProductAboutSentences(
    makeProduct({ editorial: { firmnessScore: 8, bestFor: ['Hot sleepers', 'Couples'] } }),
  );
  const fit = s.find((x) => x.startsWith("It's well suited to"));
  assert.equal(fit, "It's well suited to hot sleepers and couples.");
});

test('lists available sizes from the Size option', () => {
  const s = buildProductAboutSentences(
    makeProduct({
      options: [{ name: 'Size', values: ['Twin', 'Full', 'Queen', 'King', 'California King'] }],
    }),
  );
  const sizes = s.find((x) => x.startsWith("It's available in"));
  assert.equal(sizes, "It's available in Twin, Full, Queen, King, and California King.");
});

test('a thin one-spec product now clears the thin-content threshold', () => {
  // A near-empty merchant description on a product that nevertheless has
  // full structured data should now generate enough prose to read as
  // substantive (the point of issue 223).
  const s = buildProductAboutSentences(
    makeProduct({
      editorial: {
        firmnessScore: 7,
        layers: [{ name: 'Cooling Cover' }, { name: 'Memory Foam' }, { name: 'Support Core' }],
        positionFit: { back: 'good', side: 'great', stomach: 'good' },
      },
      options: [{ name: 'Size', values: ['Twin', 'Twin XL', 'Full', 'Queen', 'King', 'Cal King'] }],
    }),
  );
  assert.ok(s.join(' ').length >= THIN_DESCRIPTION_CHARS - 100, `copy should be substantive: ${s.join(' ').length} chars`);
});

test('htmlTextLength strips tags + entities and counts visible text', () => {
  assert.equal(htmlTextLength(''), 0);
  assert.equal(htmlTextLength(null), 0);
  assert.equal(htmlTextLength(undefined), 0);
  // "Hi there" = 8 chars after tag strip + whitespace collapse.
  assert.equal(htmlTextLength('<p>Hi&nbsp;<strong>there</strong></p>'), 8);
});

test('isThinDescription is true below threshold, false at/above it', () => {
  const long = `<p>${'word '.repeat(100)}</p>`; // ~500 chars
  assert.ok(htmlTextLength(long) >= THIN_DESCRIPTION_CHARS);
  assert.equal(isThinDescription(long), false);
  assert.equal(isThinDescription('<p>Memory foam mattress.</p>'), true);
  assert.equal(isThinDescription(''), true);
});

test('buildProductFaq interpolates the product name and warranty term', () => {
  const faq = buildProductFaq(makeProduct());
  assert.ok(faq.length >= 4);
  // Each question names the product (distinct per PDP) or is a store-policy Q.
  assert.ok(faq.some((f) => f.q.includes('Eclipse Glacier')));
  const warranty = faq.find((f) => /warranty/i.test(f.q));
  assert.match(warranty.a, /10-year manufacturer warranty/);
  // Answers are plain prose (no inline markup) for clean FAQPage JSON-LD.
  for (const f of faq) assert.ok(!/[<>]/.test(f.a), `answer should be markup-free: ${f.a}`);
});

test('buildProductFaq omits the warranty question when no warranty spec', () => {
  const faq = buildProductFaq(
    makeProduct({ specs: { heightInches: 12, firmness: 'Medium', materialType: 'Memory Foam', warrantyYears: null, trialNights: 120 } }),
  );
  assert.ok(!faq.some((f) => /warranty/i.test(f.q)));
  // Comfort-exchange answer falls back to 120 nights when trial is set.
  const exchange = faq.find((f) => /isn't comfortable/.test(f.q));
  assert.match(exchange.a, /120-night comfort exchange/);
});
