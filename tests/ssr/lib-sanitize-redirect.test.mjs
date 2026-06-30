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

const { resolveRedirectPath, buildRedirectTarget, sanitizeShopifyHtml } = await import('../../lib/sanitize.ts');

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
  // /blogs/beds-mattresses/unbeatable-savings-at-la-mattress-stores-best-4th-of-july-mattress-sale-2023
  //   → /blogs/beds-mattresses/best-4th-of-july-mattress-sale-2023
  // (long marketing-headline slug variant → canonical short slug, a
  // common Shopify legacy pattern from blog-editor renames).
  assert.equal(
    resolveRedirectPath(
      '/blogs/beds-mattresses/unbeatable-savings-at-la-mattress-stores-best-4th-of-july-mattress-sale-2023',
    ),
    '/blogs/beds-mattresses/best-4th-of-july-mattress-sale-2023',
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

/* --- destination normalization (SEMrush 20260611 "Permanent redirects") --- */

test('buildRedirectTarget: absolute own-domain destination becomes root-relative', () => {
  // Shopify Admin stores ~900 destinations as absolute apex URLs. Left
  // raw, the in-body href rewrite would emit a link that 301s apex→www.
  const m = buildRedirectTarget([
    { source: '/old', destination: 'https://mattressstoreslosangeles.com/new' },
    { source: '/old-www', destination: 'https://www.mattressstoreslosangeles.com/new' },
    { source: '/old-shop', destination: 'https://la-mattress.myshopify.com/new' },
    { source: '/old-home', destination: 'https://mattressstoreslosangeles.com/' },
  ]);
  assert.equal(m.get('/old'), '/new');
  assert.equal(m.get('/old-www'), '/new');
  assert.equal(m.get('/old-shop'), '/new');
  assert.equal(m.get('/old-home'), '/');
});

test('buildRedirectTarget: external destinations pass through untouched', () => {
  const m = buildRedirectTarget([
    { source: '/elsewhere', destination: 'https://example.com/page?_sid=keep' },
  ]);
  // Not our origin → host kept, query kept (not ours to rewrite).
  assert.equal(m.get('/elsewhere'), 'https://example.com/page?_sid=keep');
});

test('buildRedirectTarget: strips tracking params, keeps legitimate ones', () => {
  const m = buildRedirectTarget([
    // Real shape from redirects.json: harvest-green destination carries
    // a pasted storefront-search session string.
    { source: '/t1', destination: 'https://mattressstoreslosangeles.com/products/x?_pos=3&_sid=c0f408454&_ss=r' },
    // sort_by / filter.* params are functional and must survive.
    { source: '/t2', destination: 'https://mattressstoreslosangeles.com/collections/on-sale?sort_by=best-selling&filter.p.vendor=Tempur-Pedic' },
    { source: '/t3', destination: '/products/y?_pos=1&real=1#frag' },
  ]);
  assert.equal(m.get('/t1'), '/products/x');
  assert.equal(m.get('/t2'), '/collections/on-sale?sort_by=best-selling&filter.p.vendor=Tempur-Pedic');
  assert.equal(m.get('/t3'), '/products/y?real=1#frag');
});

test('buildRedirectTarget: chain-collapse sees through an absolute hop', () => {
  // A→B stored absolute, B→C relative. Before destination
  // normalization the walk could not look up the absolute B.
  const m = buildRedirectTarget([
    { source: '/a', destination: 'https://mattressstoreslosangeles.com/b' },
    { source: '/b', destination: '/c' },
  ]);
  assert.equal(m.get('/a'), '/c');
});

test('buildRedirectTarget: drops self-redirect hidden behind absolute destination', () => {
  const m = buildRedirectTarget([
    { source: '/same', destination: 'https://mattressstoreslosangeles.com/same' },
  ]);
  assert.equal(m.has('/same'), false);
});

test('resolveRedirectPath: live glossary entry lands relative with no host', () => {
  // /blogs/beds-mattresses/what-is-bamboo-infused is a real Shopify rule
  // whose stored destination is the absolute apex URL. It must resolve
  // to the relative new-blog path.
  assert.equal(
    resolveRedirectPath('/blogs/beds-mattresses/what-is-bamboo-infused'),
    '/blogs/mattress-buying-guide/what-is-bamboo-infused',
  );
});

test('resolveRedirectPath: manual layer (redirects-manual.json) is merged', () => {
  // The 4xx fix lives in the manual layer, not the Shopify export — the
  // render-time map must include it so in-body links resolve too.
  assert.equal(
    resolveRedirectPath('/collections/mattress-accessories'),
    '/collections/bedding',
  );
});

// SEMrush 20260630 audit issue #214 — internal hrefs in article bodies
// arrive carrying Shopify URL-decoration query params that 301 through
// the edge canonicalizer. Pre-stripping them in sanitize means the
// crawled href is already canonical, no 301 hop.
test('sanitizeShopifyHtml: strips Shopify noise params on a PDP href', () => {
  const out = sanitizeShopifyHtml(
    '<p><a href="/products/spruce-firm-innerspring-by-eclipse-mattress?amp;_fid=bc02da6db&_ss=c&variant=42600842592509">Spruce</a></p>',
  );
  assert.match(out, /href="\/products\/spruce-firm-innerspring-by-eclipse-mattress\?variant=42600842592509"/);
  assert.doesNotMatch(out, /_fid|_ss=|amp;/);
});

test('sanitizeShopifyHtml: strips _sid + repairs ?amp; on a collection href', () => {
  const out = sanitizeShopifyHtml(
    '<p><a href="/collections/bed-frames?amp;_sid=89c613616&_ss=r">Bed frames</a></p>',
  );
  assert.match(out, /href="\/collections\/bed-frames"/);
});

test('sanitizeShopifyHtml: preserves a legitimate filter param on a PLP href', () => {
  // ?filter.v.option.size=King is a real PLP filter, not noise — must
  // survive the canonicalize pass so the deep-linked filtered view
  // continues to work for shoppers and crawlers.
  const out = sanitizeShopifyHtml(
    '<p><a href="/collections/king-size-mattresses?filter.v.option.size=King&_ss=c">King</a></p>',
  );
  assert.match(out, /href="\/collections\/king-size-mattresses\?filter\.v\.option\.size=King"/);
});
