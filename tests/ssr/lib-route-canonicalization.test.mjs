/**
 * Unit tests for lib/route-canonicalization.ts.
 *
 * Locks down the per-route allow-list + the noise-stripping behavior
 * behind middleware.ts's storefront 301 redirects (SEMrush 20260521_1
 * follow-up — 189 "orphan pages" flagged, 183 of which were
 * query-string variants of legitimate pages).
 *
 * The function is pure: (pathname, URLSearchParams) → { shouldRedirect,
 * cleanSearch }. Tests synthesize URLSearchParams and assert both the
 * shouldRedirect flag and the resulting clean-search string.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { canonicalizeRouteParams } = await import('../../lib/route-canonicalization.ts');

/** Helper: build a URLSearchParams + run the canonicalizer. */
function check(path, qs) {
  const search = new URLSearchParams(qs);
  const r = canonicalizeRouteParams(path, search);
  return { shouldRedirect: r.shouldRedirect, clean: r.cleanSearch.toString() };
}

/* --- /products/* — only ?variant survives ----------------------------- */

test('product: bare URL with no params is canonical', () => {
  const r = check('/products/foo', '');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, '');
});

test('product: ?variant=X is canonical (legitimate Shopify variant selector)', () => {
  const r = check('/products/foo', 'variant=42');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, 'variant=42');
});

test('product: malformed `?amp;_fid=X&variant=Y` strips noise, keeps variant', () => {
  // The exact pattern SEMrush flagged — HTML-entity-encoded `&` from
  // copy-pasted email links. Param names like `amp`, `_fid`, `_ss`
  // are Shopify-proxy noise.
  const r = check(
    '/products/foo',
    'amp&_fid=655160113&_ss=c&variant=42220959727869',
  );
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, 'variant=42220959727869');
});

test('product: utm_* params get stripped', () => {
  const r = check('/products/foo', 'utm_source=email&utm_campaign=memorial-day');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, '');
});

test('product: empty `?variant=` is noise — stripped, redirects to bare URL', () => {
  const r = check('/products/foo', 'variant=');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, '');
});

test('product: gclid + fbclid are stripped (paid-ad noise)', () => {
  const r = check('/products/foo', 'gclid=abc123&fbclid=xyz789&variant=42');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, 'variant=42');
});

/* --- /collections/* — legacy Shopify params 301 to bare (Round 13) ---- */
// The app's PLP client reads only its own params (sort/after +
// FILTER_PARAMS); legacy Shopify Liquid params (variant, sort_by, page,
// filter.*) render the identical default grid, so they are canonicalized
// away to the bare URL rather than served as noindex'd duplicates
// (SEMrush 2026-07-14 issues 209/213).

test('collection: bare PLP is canonical', () => {
  const r = check('/collections/mattresses', '');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, '');
});

test('collection: legacy sort_by + page → 301 to bare', () => {
  const r = check('/collections/mattresses', 'sort_by=price-ascending&page=2');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, '');
});

test('collection: legacy filter.* params → 301 to bare', () => {
  const r = check(
    '/collections/mattresses',
    'filter.v.option.size=Queen&filter.v.price.gte=500',
  );
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, '');
});

test('collection: ?variant= on a collection is meaningless noise → 301 to bare', () => {
  const r = check('/collections/tempur-pedic-mattresses', 'variant=44029596860669');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, '');
});

test('collection: malformed ?variant=NNN? (double-?) → 301 to bare', () => {
  // The crawl surfaced `?variant=43955095830781?` — the trailing bare
  // `?` becomes part of the value; either way variant is not allow-listed.
  const r = check('/collections/spring-air-mattresses', 'variant=43955095830781?');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, '');
});

test('collection: legacy filter.* + app sort mixed → keep app sort, drop legacy', () => {
  const r = check(
    '/collections/mattresses',
    'sort=PRICE-r&filter.v.option.size=King',
  );
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, 'sort=PRICE-r');
});

/* --- /collections/* — the app's OWN sort/filter params (Round 11) ----- */
// These were missing from the PR #447 allow-list, so every sort/filter
// interaction 301'd back to the bare collection URL — the filter UI was
// silently dead in production. Locked down here so it can't regress.

test('collection: app sort param survives (?sort=PRICE-r)', () => {
  const r = check('/collections/mattresses', 'sort=PRICE-r');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, 'sort=PRICE-r');
});

test('collection: app filter params survive (vendor/size/price/firmness…)', () => {
  const r = check(
    '/collections/mattresses',
    'vendor=Helix&size=Queen%2CKing&price=500-1500&firmness=Firm&sleepPosition=Side&heightRange=10-12+inches&type=Hybrid',
  );
  assert.equal(r.shouldRedirect, false);
  assert.match(r.clean, /vendor=Helix/);
  assert.match(r.clean, /size=Queen%2CKing/);
  assert.match(r.clean, /price=500-1500/);
});

test('collection: app after cursor survives (?after=<cursor>)', () => {
  const r = check('/collections/mattresses', 'after=eyJsYXN0X2lkIjo0Mn0');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, 'after=eyJsYXN0X2lkIjo0Mn0');
});

test('collection: app params + tracking noise → keep app params, strip noise', () => {
  const r = check(
    '/collections/mattresses',
    'vendor=Helix&sort=PRICE-r&utm_source=email&srsltid=Xyz',
  );
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, 'vendor=Helix&sort=PRICE-r');
});

test('collection: empty app param values are stripped (?vendor=)', () => {
  const r = check('/collections/mattresses', 'vendor=&sort=PRICE-r');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, 'sort=PRICE-r');
});

/* --- `_rsc` (Next soft-navigation payload fetches) -------------------- */
// Stripping `_rsc` 301'd every client-side navigation's payload fetch,
// which silently dropped the query params mid-flight (part of the dead
// filter UI). It must pass through UNCHANGED on every route and must
// never, by itself, trigger a redirect.

test('_rsc alone never triggers a redirect (collection)', () => {
  const r = check('/collections/mattresses', '_rsc=1a2b3');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, '_rsc=1a2b3');
});

test('_rsc alone never triggers a redirect (homepage)', () => {
  const r = check('/', '_rsc=1a2b3');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, '_rsc=1a2b3');
});

test('_rsc rides along with app params without being dropped', () => {
  const r = check('/collections/mattresses', 'vendor=Helix&_rsc=1a2b3');
  assert.equal(r.shouldRedirect, false);
  assert.match(r.clean, /vendor=Helix/);
  assert.match(r.clean, /_rsc=1a2b3/);
});

test('_rsc is preserved even when noise forces a redirect', () => {
  const r = check('/products/foo', 'utm_source=email&_rsc=1a2b3');
  assert.equal(r.shouldRedirect, true);
  assert.match(r.clean, /_rsc=1a2b3/);
  assert.doesNotMatch(r.clean, /utm_source/);
});

/* --- /blogs/* — only page + after survive ---------------------------- */

test('blog: bare /blogs is canonical', () => {
  const r = check('/blogs', '');
  assert.equal(r.shouldRedirect, false);
});

test('blog: ?page=2 is canonical', () => {
  const r = check('/blogs/mattress-buying-guide', 'page=2');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, 'page=2');
});

test('blog article: any param gets stripped', () => {
  // Article URLs shouldn't carry params at all — pure content reads.
  const r = check(
    '/blogs/mattress-buying-guide/best-mattress-los-angeles',
    'utm_source=newsletter&fbclid=abc',
  );
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, '');
});

/* --- / (homepage) — no query surface; all params stripped ------------- */

test('homepage: bare / is canonical', () => {
  const r = check('/', '');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, '');
});

test('homepage: malformed `?amp;_fid=…&variant=…` strips everything → clean /', () => {
  // SEMrush 20260614 orphan pattern: leaked Shopify-proxy homepage URL.
  const r = check('/', 'amp&_fid=655160113&_ss=c&variant=42220959727869');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, '');
});

test('homepage: ?variant=, ?_sid=, ?preview_key= are all noise → stripped', () => {
  for (const qs of ['variant=4905191211037', '_sid=a5f38b4a7&_ss=r', 'preview_key=5b55ecf3']) {
    const r = check('/', qs);
    assert.equal(r.shouldRedirect, true, `should redirect for /?${qs}`);
    assert.equal(r.clean, '', `should strip all for /?${qs}`);
  }
});

test('homepage: the / entry does not over-match /products or /collections', () => {
  // /^\/$/ is anchored, so deeper routes keep their own allow-specs.
  // Use params each route's own spec ALLOWS (variant on PDP, sort on
  // PLP) — the homepage empty-allow spec would strip both, so
  // shouldRedirect=false proves the deeper spec applied, not `/`.
  assert.equal(check('/products/foo', 'variant=42').shouldRedirect, false);
  assert.equal(check('/collections/mattresses', 'sort=PRICE-r').shouldRedirect, false);
});

/* --- /search ---------------------------------------------------------- */

test('search: ?q=foo is canonical', () => {
  const r = check('/search', 'q=mattress');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, 'q=mattress');
});

test('search: tracking params get stripped, q preserved', () => {
  const r = check('/search', 'q=mattress&utm_source=google&gclid=abc');
  assert.equal(r.shouldRedirect, true);
  assert.equal(r.clean, 'q=mattress');
});

/* --- Unmatched routes pass through ------------------------------------ */

test('unknown route: passes through unchanged (defensive)', () => {
  // Future routes that aren't on the allow-list shouldn't have their
  // params stripped blindly — the function returns shouldRedirect=false
  // and the middleware does nothing.
  const r = check('/cart', 'something=here');
  assert.equal(r.shouldRedirect, false);
  assert.equal(r.clean, 'something=here');
});

test('admin route: passes through (middleware skips canonicalize for admin)', () => {
  // The canonicalizer doesn't have an /admin entry, so it returns
  // shouldRedirect=false. Middleware additionally short-circuits
  // before calling this function for /admin paths.
  const r = check('/admin/dashboard', 'range=30d');
  assert.equal(r.shouldRedirect, false);
});

/* --- Idempotency ------------------------------------------------------ */

test('idempotency: canonical URLs stay canonical', () => {
  // Apply twice — the second pass should be a no-op.
  const inputs = [
    ['/products/foo', 'variant=42'],
    ['/collections/mattresses', 'vendor=Helix&sort=PRICE-r'],
    ['/blogs', 'page=3'],
    ['/search', 'q=hello'],
  ];
  for (const [path, qs] of inputs) {
    const once = check(path, qs);
    assert.equal(once.shouldRedirect, false, `first pass should be canonical for ${path}?${qs}`);
    const twice = check(path, once.clean);
    assert.equal(twice.shouldRedirect, false, `second pass should also be canonical for ${path}?${qs}`);
  }
});
