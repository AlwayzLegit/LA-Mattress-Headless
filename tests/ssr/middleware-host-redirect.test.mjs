/**
 * Middleware host-canonicalization contract (audit seo-organic-03 +
 * codeq-test-gaps-02): a request arriving with the apex Host header
 * must 308 to the same path on www. The 2026-07-03 Semrush pull showed
 * 63 keywords ranking under the apex host and ~30 paths indexed under
 * BOTH hosts; canonicals said www but the response host never agreed.
 *
 * Uses node:http directly (with setHost:false) because undici's fetch
 * silently drops a user-supplied Host header.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const BASE = new URL(process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000');

function requestWithHost(path, host) {
  return new Promise((resolveP, rejectP) => {
    const req = http.request(
      {
        hostname: BASE.hostname,
        port: BASE.port || 80,
        path,
        method: 'GET',
        setHost: false,
        headers: { Host: host },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolveP({ status: res.statusCode, location: res.headers.location ?? null }));
      },
    );
    req.on('error', rejectP);
    req.end();
  });
}

test('apex host 308s to www preserving path and query', async () => {
  const { status, location } = await requestWithHost('/collections/mattresses?sort_by=price-ascending', 'mattressstoreslosangeles.com');
  assert.equal(status, 308, 'apex request should be permanently redirected');
  assert.equal(
    location,
    'https://www.mattressstoreslosangeles.com/collections/mattresses?sort_by=price-ascending',
  );
});

test('www host is served, not redirected by the host branch', async () => {
  const { status, location } = await requestWithHost('/', 'www.mattressstoreslosangeles.com');
  assert.notEqual(status, 308, `www request must not host-redirect (got ${status} -> ${location})`);
});
