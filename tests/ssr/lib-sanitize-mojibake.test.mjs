/**
 * Unit tests for repairMojibake in lib/sanitize.ts — repairs U+FFFD (�)
 * corruption from the old Shopify export's bad UTF-8 transcode. Locks in
 * the recovery order (trademark/degree before space/strip) and that HTML
 * structure is never touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const repairModule = await import('../../lib/sanitize.ts');
const { repairMojibake } = repairModule;
const R = '�'; // �

test('no-op when there is no mojibake', () => {
  const s = '<p>Clean 20°C content with <a href="/x">a link</a>.</p>';
  assert.equal(repairMojibake(s), s);
});

test('recovers the TEMPUR-ES registered trademark', () => {
  assert.equal(repairMojibake(`TEMPUR-ES${R} Comfort`), 'TEMPUR-ES® Comfort');
});

test('recovers the degree sign', () => {
  assert.equal(repairMojibake(`Keep the room at 20${R}C`), 'Keep the room at 20°C');
  assert.equal(repairMojibake(`about 68${R}F here`), 'about 68°F here');
});

test('corrupted word gap becomes a single space', () => {
  assert.equal(repairMojibake(`5 Ways${R}to Deflate`), '5 Ways to Deflate');
  assert.equal(repairMojibake(`detailed comparison.${R}Both brands`), 'detailed comparison. Both brands');
});

test('stray junk hugging a tag boundary is dropped (no double space)', () => {
  assert.equal(repairMojibake(`<span>${R}</span>`), '<span></span>');
  assert.equal(repairMojibake(`needs.${R}</p>`), 'needs.</p>');
  assert.equal(repairMojibake(`400;">${R}- a higher`), '400;">- a higher');
});

test('runs of � collapse cleanly inside a numbered list', () => {
  assert.equal(repairMojibake(`1.${R}${R}${R} Influential`), '1. Influential');
});

test('leaves all HTML markup characters intact + removes every �', () => {
  const dirty = `<h2 data-x="y">A${R}B</h2><p>c${R}${R}<a href="/z?q=1&a=2">L</a>${R}</p>`;
  const out = repairMojibake(dirty);
  assert.equal(out.indexOf(R), -1, 'no � left');
  assert.equal((dirty.match(/</g) || []).length, (out.match(/</g) || []).length);
  assert.equal((dirty.match(/>/g) || []).length, (out.match(/>/g) || []).length);
  assert.match(out, /href="\/z\?q=1&a=2"/); // attributes untouched
});

test('stripEditorCruft removes data-mce-* attributes, keeps tags/content/href', () => {
  const { stripEditorCruft } = repairModule;
  const dirty = '<p data-mce-fragment="1">Hi <a href="/x" data-mce-href="/x" data-mce-fragment="1">link</a></p>';
  const out = stripEditorCruft(dirty);
  assert.equal(out, '<p>Hi <a href="/x">link</a></p>');
  assert.equal(out.includes('data-mce'), false);
});
