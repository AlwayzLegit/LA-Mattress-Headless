/**
 * Unit tests for lib/seo.ts — the title/description helpers behind
 * every rendered <title> on the site.
 *
 * Locks the audit seo-tech-02 fix: capTitle's brand-suffix detection
 * must know EVERY separator the metadata generators actually append —
 * pipe, en/em dash, hyphen, and the PDP's middle dot. Before the fix,
 * 66 of 218 PDP titles overflowed and 25 truncated INTO the suffix,
 * rendering "… · LA Mattres…" in SERPs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { capTitle, composeBrandTitle, ensureTitleDistinctFromH1, firstNonEmpty, pdpTitleBase, stripBrandSuffix, truncDescription } =
  await import('../../lib/seo.ts');

const SUFFIXES = [' | LA Mattress', ' — LA Mattress Store', ' - LA Mattress', ' · LA Mattress Store', ' – LA Mattress'];

test('capTitle: short titles pass through untouched', () => {
  assert.equal(capTitle('Queen Mattress Sale'), 'Queen Mattress Sale');
});

test('capTitle: overflow caused by a brand suffix drops the WHOLE suffix, never truncates into it', () => {
  for (const suffix of SUFFIXES) {
    const base = 'Diamond Dreamstage 2.0 Arise Luxe Plush Cooling Hybrid Mattress';
    const capped = capTitle(`${base}${suffix}`);
    assert.equal(capped, base, `suffix ${JSON.stringify(suffix)} should be dropped whole`);
    assert.ok(!capped.includes('LA Mattres…'), 'must never render a mid-suffix ellipsis');
  }
});

test('capTitle: the PDP middle-dot suffix specifically (audit seo-tech-02 regression)', () => {
  const base = 'Standard Profile 9" Box Spring Universal Flat Foundation XL';
  const full = `${base} · LA Mattress Store`;
  assert.ok(full.length > 70, 'fixture must overflow the 70-char cap');
  assert.equal(capTitle(full), base);
});

test('capTitle: overflowing base with no suffix truncates with ellipsis', () => {
  const long = 'A'.repeat(80);
  const capped = capTitle(long);
  assert.equal(capped.length, 70);
  assert.ok(capped.endsWith('…'));
});

test('capTitle: base still overflowing after suffix drop truncates the base cleanly', () => {
  const base = 'B'.repeat(80);
  const capped = capTitle(`${base} | LA Mattress`);
  assert.equal(capped.length, 70);
  assert.ok(capped.endsWith('…'));
  assert.ok(!capped.includes('LA Mattres'));
});

test('ensureTitleDistinctFromH1: appends brand suffix only on collapse, idempotent, ≤70 chars', () => {
  const distinct = ensureTitleDistinctFromH1('Best Mattress Guide 2026', 'How to pick a mattress');
  assert.equal(distinct, 'Best Mattress Guide 2026');

  const collapsed = ensureTitleDistinctFromH1('Best Mattress for Back Pain', 'Best Mattress for Back Pain');
  assert.equal(collapsed, 'Best Mattress for Back Pain | LA Mattress Store');
  assert.ok(collapsed.length <= 70);
  // Idempotent: running it again must not double-brand.
  assert.equal(ensureTitleDistinctFromH1(collapsed, 'Best Mattress for Back Pain'), collapsed);
});

test('composeBrandTitle: brand-led slogans used verbatim, taglines composed', () => {
  assert.equal(
    composeBrandTitle('LA Mattress Store', 'LA Mattress | Shop Sales on Best Mattresses', 'fb'),
    'LA Mattress | Shop Sales on Best Mattresses',
  );
  assert.equal(
    composeBrandTitle('LA Mattress Store', 'Sleep, engineered in Los Angeles.', 'fb'),
    'LA Mattress Store — Sleep, engineered in Los Angeles.',
  );
  assert.equal(composeBrandTitle('LA Mattress Store', '  ', 'fallback'), 'fallback');
});

test('stripBrandSuffix + firstNonEmpty basics', () => {
  assert.equal(stripBrandSuffix('Warranty Info | LA Mattress'), 'Warranty Info');
  assert.equal(firstNonEmpty('', null, undefined, '  ', 'real'), 'real');
});

test('truncDescription caps at 160 with ellipsis', () => {
  const long = 'x'.repeat(200);
  const out = truncDescription(long);
  assert.equal(out.length, 160);
  assert.ok(out.endsWith('...'));
  assert.equal(truncDescription('short'), 'short');
});

test('pdpTitleBase: short names pass through, over-long names drop the leading vendor', () => {
  // Short name: suffixed title fits — untouched.
  assert.equal(pdpTitleBase('Birch Natural Mattress', 'Birch'), 'Birch Natural Mattress');
  // Over-long name led by the vendor: vendor is dropped.
  assert.equal(
    pdpTitleBase('Brooklyn Bedding Signature Hybrid Cloud Pillow Top Firm Mattress', 'Brooklyn Bedding'),
    'Signature Hybrid Cloud Pillow Top Firm Mattress',
  );
  // Over-long name NOT led by the vendor: left alone (capping handles it).
  const long = 'Some Extremely Long Product Name That Overflows The Title Cap Easily';
  assert.equal(pdpTitleBase(long, 'Brooklyn Bedding'), long);
});

test('pdpTitleBase composition: Firm/Medium/Soft siblings keep distinct titles (Semrush issue 6, 2026-07-21)', () => {
  // The three Signature Hybrid Cloud Pillow Top PDPs rendered one
  // identical <title> because the collapse branch truncated away the
  // firmness word. Lock the fixed composition end-to-end.
  const titles = ['Firm', 'Medium', 'Soft'].map((f) => {
    const productTitle = `Brooklyn Bedding Signature Hybrid Cloud Pillow Top ${f} Mattress`;
    return ensureTitleDistinctFromH1(
      `${pdpTitleBase(productTitle, 'Brooklyn Bedding')} | LA Mattress Store`,
      productTitle,
    );
  });
  assert.equal(new Set(titles).size, 3, `titles must be unique, got: ${titles.join(' // ')}`);
  for (const [i, f] of ['Firm', 'Medium', 'Soft'].entries()) {
    assert.ok(titles[i].includes(f), `"${titles[i]}" must keep its firmness word ${f}`);
    assert.ok(titles[i].length <= 70, `"${titles[i]}" must fit the 70-char cap`);
    assert.ok(titles[i].endsWith('| LA Mattress Store'), 'brand suffix must survive');
  }
});
