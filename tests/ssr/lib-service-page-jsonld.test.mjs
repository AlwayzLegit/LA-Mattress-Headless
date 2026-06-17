/**
 * Unit tests for buildServicePageLd (lib/service-page-jsonld.ts) — the
 * domain JSON-LD (Service / FinancialProduct) emitted on the confidence
 * service pages (SEO plan Phase 4).
 *
 * Pure lib import via Node strip-types; the module only imports
 * lib/service-pages.ts, whose lone import is a type-only IconName (erased
 * at runtime), so it loads without a dev server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildServicePageLd } = await import('../../lib/service-page-jsonld.ts');

const SITE = 'https://www.mattressstoreslosangeles.com';

test('financing page emits a FinancialProduct with 0% APR', () => {
  const ld = buildServicePageLd('mattress-store-financing');
  assert.equal(ld['@type'], 'FinancialProduct');
  assert.equal(ld.annualPercentageRate, 0);
  assert.equal(ld['@id'], `${SITE}/pages/mattress-store-financing#service`);
  assert.deepEqual(ld.provider, { '@id': `${SITE}/#organization` });
  assert.equal(ld.areaServed.name, 'Los Angeles');
  assert.ok(typeof ld.description === 'string' && ld.description.length > 0);
});

test('delivery page emits a Service node', () => {
  const ld = buildServicePageLd('mattress-store-delivery');
  assert.equal(ld['@type'], 'Service');
  assert.match(ld.name, /Delivery/);
  assert.equal(ld.serviceType, 'White-glove mattress delivery');
});

test('guarantee, price-guarantee, and warranty pages each emit a Service', () => {
  for (const handle of ['love-your-bed-guarantee', 'lowest-price-guarantee', 'warranty']) {
    const ld = buildServicePageLd(handle);
    assert.equal(ld['@type'], 'Service', `${handle} should be a Service`);
    assert.equal(ld['@id'], `${SITE}/pages/${handle}#service`);
    assert.ok(ld.serviceType, `${handle} should carry a serviceType`);
  }
});

test('about + contact pages carry no domain offering (null → WebPage only)', () => {
  assert.equal(buildServicePageLd('about'), null);
  assert.equal(buildServicePageLd('mattress-store-contact'), null);
});

test('every emitted node is tied to the sitewide Organization and is valid-shaped', () => {
  for (const handle of [
    'mattress-store-financing',
    'mattress-store-delivery',
    'love-your-bed-guarantee',
    'lowest-price-guarantee',
    'warranty',
  ]) {
    const ld = buildServicePageLd(handle);
    assert.equal(ld['@context'], 'https://schema.org');
    assert.deepEqual(ld.provider, { '@id': `${SITE}/#organization` });
    assert.ok(ld.name, `${handle} must have a name`);
  }
});
