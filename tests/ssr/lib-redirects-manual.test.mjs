/**
 * Guards the manual-redirect layer (data/url-inventory/redirects-manual.json
 * → merged by scripts/build-redirects-table.mjs → lib/redirects-table.ts).
 *
 * These redirects exist BECAUSE the daily pull-inventory.mjs sync rewrites
 * redirects.json wholesale from Shopify Admin — anything added only there
 * vanishes on the next sync. This test fails loudly if a regeneration ever
 * drops a manual entry, so the fix can't silently regress.
 *
 * No dev server needed — pure lib import via Node 22 strip-types.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { REDIRECTS } = await import('../../lib/redirects-table.ts');
const manual = JSON.parse(
  readFileSync(new URL('../../data/url-inventory/redirects-manual.json', import.meta.url), 'utf8'),
);

test('every manual redirect is present in the generated table', () => {
  for (const r of manual.redirects) {
    assert.equal(
      REDIRECTS.get(r.source),
      r.destination,
      `manual redirect ${r.source} → ${r.destination} missing from lib/redirects-table.ts ` +
        `(re-run scripts/build-redirects-table.mjs after editing redirects-manual.json)`,
    );
  }
});

test('the mattress-accessories 4xx fix (SEMrush 20260611) is wired', () => {
  // Explicit lock on the specific fix this layer was created for.
  assert.equal(REDIRECTS.get('/collections/mattress-accessories'), '/pages/mattress-accessories');
});
