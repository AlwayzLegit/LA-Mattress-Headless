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

const { capTitle, composeBrandTitle, ensureTitleDistinctFromH1, firstNonEmpty, stripBrandSuffix, truncDescription } =
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
