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

test('stripEditorCruft removes empty spans, Word mso styles, redundant font-weight; unwraps bare spans', () => {
  const { stripEditorCruft } = repairModule;
  assert.equal(stripEditorCruft('<p>a<span></span>b</p>'), '<p>ab</p>');
  assert.equal(stripEditorCruft('<p><span>  </span>hi</p>'), '<p>hi</p>');
  assert.equal(stripEditorCruft('<span>just text</span>'), 'just text');
  // mso-* dropped; real declaration kept
  assert.equal(stripEditorCruft('<p style="mso-list: l0; color: red">x</p>'), '<p style="color: red">x</p>');
  // style becomes empty -> attribute removed
  assert.equal(stripEditorCruft('<p style="font-weight: 400">x</p>'), '<p>x</p>');
  // real bold weight preserved
  assert.match(stripEditorCruft('<p style="font-weight: 700">x</p>'), /style="font-weight: 700"/);
});

test('stripEditorCruft preserves real bold text content/markup', () => {
  const { stripEditorCruft } = repairModule;
  const out = stripEditorCruft('<p><strong>Bold</strong> and <span>plain</span> text</p>');
  assert.equal(out, '<p><strong>Bold</strong> and plain text</p>');
});

test('stripDeadHotlinks removes restonic.com hotlinked images, keeps other images + text', () => {
  const { stripDeadHotlinks } = repairModule;
  // dead restonic hotlink inside a heading -> img gone, heading text kept
  assert.equal(
    stripDeadHotlinks('<h2><img alt="x" src="https://restonic.com/wp-content/uploads/2017/07/04-jfk.jpg" width="225">Snorers</h2>'),
    '<h2>Snorers</h2>',
  );
  // standalone paragraph image -> empty <p> collapsed
  assert.equal(stripDeadHotlinks('<p><img src="https://restonic.com/a.jpg"></p>'), '');
  // Shopify CDN and other images are untouched
  const keep = '<p><img src="https://cdn.shopify.com/x.jpg">caption</p>';
  assert.equal(stripDeadHotlinks(keep), keep);
});
