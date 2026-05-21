/**
 * Unit tests for resolveRedirectPath in lib/sanitize.ts — the single-
 * path resolver used by the HTML sitemap page + PLP guides block to
 * rewrite hardcoded internal hrefs through redirects.json before the
 * crawler ever sees a 301.
 *
 * The function pulls live data from the committed redirects.json, so
 * the tests don't need to mock anything — they just exercise the
 * known SEMrush-flagged redirect sources and a handful of structural
 * edge cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveRedirectPath, buildRedirectTarget } = await import('../../lib/sanitize.ts');

test('returns the input unchanged for a non-redirect path', () => {
  // /collections/mattresses is a live PLP, NOT a redirect source.
  assert.equal(resolveRedirectPath('/collections/mattresses'), '/collections/mattresses');
});

test('chain-collapses a known multi-source slug to the final destination', () => {
  // /collections/box-spring-foundations → /collections/foundations
  // (added in PR #232's SEMrush backfill).
  assert.equal(
    resolveRedirectPath('/collections/box-spring-foundations'),
    '/collections/foundations',
  );
});

test('rewrites a /pages variant slug to its canonical handle', () => {
  // /pages/hancock-park-best-mattress-store → /pages/best-mattress-store-la-brea
  // (added in PR #232).
  assert.equal(
    resolveRedirectPath('/pages/hancock-park-best-mattress-store'),
    '/pages/best-mattress-store-la-brea',
  );
});

test('rewrites a blog-article slug variant', () => {
  // /blogs/mattress-buying-guide/queen-mattress-size-guide-inches-feet-how-to-pick-the-perfect-fit
  //   → /blogs/mattress-buying-guide/full-vs-queen-mattress
  // (from the size-cluster redirect group).
  assert.equal(
    resolveRedirectPath(
      '/blogs/mattress-buying-guide/queen-mattress-size-guide-inches-feet-how-to-pick-the-perfect-fit',
    ),
    '/blogs/mattress-buying-guide/full-vs-queen-mattress',
  );
});

test('preserves query string + hash on rewrite', () => {
  // A redirected path with ?foo=bar should land at <dest>?foo=bar.
  assert.equal(
    resolveRedirectPath('/collections/box-spring-foundations?sort_by=price-ascending'),
    '/collections/foundations?sort_by=price-ascending',
  );
  assert.equal(
    resolveRedirectPath('/collections/box-spring-foundations#section'),
    '/collections/foundations#section',
  );
});

test('returns external URLs unchanged (defensive)', () => {
  // Function is for internal paths only; full URLs should pass through.
  assert.equal(
    resolveRedirectPath('https://example.com/collections/foundations'),
    'https://example.com/collections/foundations',
  );
});

test('returns protocol-relative URLs unchanged (defensive)', () => {
  // //example.com/foo is protocol-relative; not an internal path.
  assert.equal(
    resolveRedirectPath('//cdn.shopify.com/files/foo.jpg'),
    '//cdn.shopify.com/files/foo.jpg',
  );
});

test('returns root path unchanged', () => {
  assert.equal(resolveRedirectPath('/'), '/');
});

test('handles malformed inputs gracefully', () => {
  // The function is called from server-rendered Link hrefs; bad input
  // shouldn't crash the page render.
  assert.equal(resolveRedirectPath(''), '');
  assert.equal(resolveRedirectPath('relative/path'), 'relative/path');
});

test('idempotent: resolveRedirectPath(resolveRedirectPath(x)) === resolveRedirectPath(x)', () => {
  // The chain-collapse at module init means every entry in the map
  // points at a terminal URL — applying the helper twice must hit the
  // same destination. Cowork 20260521 follow-up.
  const inputs = [
    '/collections/box-spring-foundations',
    '/pages/hancock-park-best-mattress-store',
    '/collections/mattresses',
    '/some/random/path',
  ];
  for (const x of inputs) {
    const once = resolveRedirectPath(x);
    const twice = resolveRedirectPath(once);
    assert.equal(twice, once, `not idempotent for ${x}`);
  }
});

/* --- buildRedirectTarget — chain-collapse + cycle behaviour --- */

test('buildRedirectTarget: chains A→B→C collapse to A→C', () => {
  const m = buildRedirectTarget([
    { source: '/a', destination: '/b' },
    { source: '/b', destination: '/c' },
  ]);
  assert.equal(m.get('/a'), '/c', 'A should land directly on C');
  assert.equal(m.get('/b'), '/c', 'B still maps to C');
});

test('buildRedirectTarget: drops 2-node cycle (A→B, B→A) entirely', () => {
  // Cowork 20260521 follow-up: when the chain loops back on itself
  // there's no terminal destination, so the only safe thing to do is
  // drop the entry. The runtime then serves the path as a normal 404
  // (recoverable) instead of issuing a self-redirect that loops
  // forever in the browser.
  //
  // The map's size = 0 captures the intent: a cyclic group contributes
  // nothing to the redirect output. The crucial property is that
  // building completes in bounded time without throwing.
  const m = buildRedirectTarget([
    { source: '/a', destination: '/b' },
    { source: '/b', destination: '/a' },
  ]);
  assert.equal(m.has('/a'), false, 'cyclic source should be dropped');
  assert.equal(m.has('/b'), false, 'cyclic source should be dropped');
  assert.equal(m.size, 0);
});

test('buildRedirectTarget: drops 3-node cycle (A→B→C→A) entirely', () => {
  // Same guarantee as the 2-node case, but ensures the cycle
  // detection works when the cycle returns through an intermediate
  // node rather than directly bouncing.
  const m = buildRedirectTarget([
    { source: '/a', destination: '/b' },
    { source: '/b', destination: '/c' },
    { source: '/c', destination: '/a' },
  ]);
  assert.equal(m.size, 0);
});

test('buildRedirectTarget: keeps non-cyclic neighbors of a cycle', () => {
  // If /a→/b→/a is a cycle but /z→/terminal is independent, the
  // independent chain still resolves correctly. The cycle guard
  // operates per-start, not over the whole map.
  const m = buildRedirectTarget([
    { source: '/a', destination: '/b' },
    { source: '/b', destination: '/a' },
    { source: '/z', destination: '/terminal' },
  ]);
  assert.equal(m.size, 1);
  assert.equal(m.get('/z'), '/terminal');
});

test('buildRedirectTarget: bails after 12 hops on a longer chain (defensive cap)', () => {
  // Construct a 20-hop chain. The cap allows 12 iterations of follow-
  // up, so starting from /node-0 the resolver lands somewhere in the
  // chain but not at /node-19. Important is that it terminates.
  const rules = Array.from({ length: 20 }, (_, i) => ({
    source: `/node-${i}`,
    destination: `/node-${i + 1}`,
  }));
  const m = buildRedirectTarget(rules);
  // First entry should resolve to somewhere meaningful (>node-0).
  const result = m.get('/node-0');
  assert.ok(result, 'should produce a destination');
  assert.notEqual(result, '/node-0');
  // Map built without throwing — that's the defensive-cap pass.
  assert.equal(m.size, 20);
});

test('buildRedirectTarget: drops self-redirects', () => {
  const m = buildRedirectTarget([
    { source: '/loop', destination: '/loop' },
    { source: '/real', destination: '/dest' },
  ]);
  assert.equal(m.has('/loop'), false);
  assert.equal(m.get('/real'), '/dest');
});

test('buildRedirectTarget: skips malformed rules without throwing', () => {
  const m = buildRedirectTarget([
    { source: null, destination: '/x' },
    { source: '/a', destination: null },
    { source: '/valid', destination: '/y' },
    null,
    {},
  ]);
  assert.equal(m.size, 1);
  assert.equal(m.get('/valid'), '/y');
});

test('buildRedirectTarget: normalizes trailing slash on source', () => {
  // `/foo/` and `/foo` should map to the same destination — the
  // normalizer strips trailing slashes from source keys.
  const m = buildRedirectTarget([
    { source: '/foo/', destination: '/bar' },
  ]);
  assert.equal(m.get('/foo'), '/bar');
});
