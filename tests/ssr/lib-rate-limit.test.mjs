/**
 * Unit tests for lib/rate-limit.ts — the in-memory fixed-window limiter
 * guarding /api/chat, /api/newsletter, /api/ccpa-request. Locks in the
 * window semantics (limit inclusive, 429 only past it), per-bucket and
 * per-client isolation, and the XFF parsing in getClientIp.
 *
 * No dev server needed — pure lib import via Node 22 strip-types.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { rateLimit, getClientIp, rateLimitResponse } = await import('../../lib/rate-limit.ts');

// Each test uses its own bucket name so module-level state can't leak
// between tests regardless of execution order.

test('allows exactly `limit` hits, limits the next one', () => {
  for (let i = 1; i <= 5; i++) {
    assert.equal(rateLimit('t-exact', 'ip1', 5, 60_000).limited, false, `hit ${i} should pass`);
  }
  const sixth = rateLimit('t-exact', 'ip1', 5, 60_000);
  assert.equal(sixth.limited, true);
  assert.ok(sixth.retryAfterSeconds >= 1, 'retryAfter must be at least 1s');
  assert.ok(sixth.retryAfterSeconds <= 60, 'retryAfter cannot exceed the window');
});

test('clients do not share counters', () => {
  for (let i = 0; i < 3; i++) rateLimit('t-clients', 'ip-a', 3, 60_000);
  assert.equal(rateLimit('t-clients', 'ip-a', 3, 60_000).limited, true);
  assert.equal(rateLimit('t-clients', 'ip-b', 3, 60_000).limited, false);
});

test('buckets do not share counters', () => {
  for (let i = 0; i < 3; i++) rateLimit('t-bucket-1', 'same-ip', 3, 60_000);
  assert.equal(rateLimit('t-bucket-1', 'same-ip', 3, 60_000).limited, true);
  assert.equal(rateLimit('t-bucket-2', 'same-ip', 3, 60_000).limited, false);
});

test('window expiry resets the counter', async () => {
  for (let i = 0; i < 2; i++) rateLimit('t-expiry', 'ip1', 2, 50);
  assert.equal(rateLimit('t-expiry', 'ip1', 2, 50).limited, true);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(rateLimit('t-expiry', 'ip1', 2, 50).limited, false, 'fresh window after expiry');
});

test('getClientIp prefers first x-forwarded-for hop', () => {
  const req = new Request('http://x/', {
    headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' },
  });
  assert.equal(getClientIp(req), '203.0.113.7');
});

test('getClientIp falls back to x-real-ip, then "unknown"', () => {
  const real = new Request('http://x/', { headers: { 'x-real-ip': '198.51.100.4' } });
  assert.equal(getClientIp(real), '198.51.100.4');
  assert.equal(getClientIp(new Request('http://x/')), 'unknown');
});

test('rateLimitResponse is a no-store 429 with Retry-After', async () => {
  const res = rateLimitResponse(17);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('Retry-After'), '17');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(typeof body.error, 'string');
});
