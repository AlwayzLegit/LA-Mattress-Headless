/**
 * Integration tests for API failure modes (session 2026-06-10 audit
 * follow-up). The audit found /api/load-more-products and
 * /api/predictive-search masked Storefront outages as empty 200s; they
 * now return 503 + no-store. The newsletter/ccpa/chat routes gained an
 * in-memory rate limiter. These tests pin the externally observable
 * contracts against the running dev server.
 *
 * Side-effect safety: the rate-limit test posts an INVALID email on
 * purpose — the limiter runs before validation, and validation rejects
 * the body before any Shopify Admin call, so no customer records are
 * created even when CI has real Shopify secrets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOPIFY_CONFIGURED } from './_helpers.mjs';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3100';

test('load-more without required params returns 400', async () => {
  const res = await fetch(`${BASE_URL}/api/load-more-products`);
  assert.equal(res.status, 400);
});

test('predictive-search under 2 chars returns empty 200 (no upstream call)', async () => {
  const res = await fetch(`${BASE_URL}/api/predictive-search?q=a`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.products, []);
});

// Inverse of the usual SHOPIFY_SKIP: with no Storefront credentials the
// upstream call throws, which IS the outage path we want to observe.
// When CI gains Shopify secrets this skips (the call would succeed).
test(
  'predictive-search surfaces upstream failure as 503 no-store, not empty 200',
  { skip: SHOPIFY_CONFIGURED ? 'Shopify configured — upstream succeeds, outage path not reachable' : false },
  async () => {
    const res = await fetch(`${BASE_URL}/api/predictive-search?q=mattress`);
    assert.equal(res.status, 503, 'outage must not masquerade as empty results');
    assert.equal(res.headers.get('cache-control'), 'no-store', 'failures must not be edge-cached');
  },
);

test('newsletter rate limiter: 6th rapid request gets 429 + Retry-After', async () => {
  // Limit is 5/min per IP (all local requests share the dev-server
  // "unknown" client bucket — fine, this file is the only newsletter
  // caller in the suite). Invalid email → 400 pre-Shopify, no writes.
  const post = () =>
    fetch(`${BASE_URL}/api/newsletter`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await post()).status);

  assert.deepEqual(statuses.slice(0, 5), [400, 400, 400, 400, 400], 'first 5 hit validation');
  assert.equal(statuses[5], 429, '6th request must be rate-limited');

  const limited = await post();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) >= 1, '429 carries Retry-After');
});
