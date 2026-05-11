/**
 * OG meta regression suite — protects Phases 169 (Twitter Card inheritance),
 * 176/180 (collection / article / PDP OG image fallback), and 188 (OG
 * fallback extended to blog index / CMS pages / sleep-quiz).
 *
 * Constraint: this test environment runs `next dev` without Shopify env
 * vars, so any route that requires the Storefront API 404s cleanly
 * (`if (!SHOPIFY_CONFIGURED) notFound()`). That rules out /collections/*,
 * /products/*, /blogs/*, /pages/* — those need a Shopify-connected
 * environment to test. The routes we CAN cover here are the layout-level
 * inheritance and routes whose metadata doesn't depend on Shopify:
 *
 *   - `/`                — homepage layout inheritance (Phase 169)
 *   - `/sleep-quiz`      — explicit Phase 188 fallback (no Shopify data)
 *
 * Future browser- or Shopify-enabled CI can extend this with the
 * /blogs / /pages / /products / /collections coverage that was
 * empirically verified manually in PR #53 / #54 sign-off.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200 } from './_helpers.mjs';

test('/ emits an og:image (layout-level inheritance)', async () => {
  const res = await fetchHtml('/');
  expect200(res, '/');
  const ogImage = res.$('meta[property="og:image"]').attr('content');
  assert.ok(
    ogImage,
    'expected <meta property="og:image"> on /, found none',
  );
  assert.ok(
    ogImage.includes('/opengraph-image'),
    `expected og:image to reference /opengraph-image, got: ${ogImage}`,
  );
});

test('/ emits og:title and og:url (Twitter card inheritance, Phase 169)', async () => {
  const res = await fetchHtml('/');
  const ogTitle = res.$('meta[property="og:title"]').attr('content') ?? '';
  const ogUrl = res.$('meta[property="og:url"]').attr('content') ?? '';
  assert.ok(ogTitle.length > 0, 'expected non-empty og:title on /');
  assert.ok(ogUrl.length > 0, 'expected non-empty og:url on /');
  // Twitter card type should be summary_large_image (set in layout)
  const twCard = res.$('meta[name="twitter:card"]').attr('content');
  assert.equal(twCard, 'summary_large_image');
});

test('/sleep-quiz emits the explicit /opengraph-image fallback (Phase 188)', async () => {
  const res = await fetchHtml('/sleep-quiz');
  expect200(res, '/sleep-quiz');
  const ogImage = res.$('meta[property="og:image"]').attr('content') ?? '';
  // Phase 188 explicitly added images: [{ url: '/opengraph-image', ... }]
  // The dev server may serve it with a hash query string or full URL —
  // either form is acceptable, only the /opengraph-image substring is
  // load-bearing.
  assert.ok(
    ogImage.includes('/opengraph-image'),
    `expected /opengraph-image fallback on /sleep-quiz, got: ${ogImage}`,
  );
  // Width / height that Phase 188 hardcoded
  const w = res.$('meta[property="og:image:width"]').attr('content');
  const h = res.$('meta[property="og:image:height"]').attr('content');
  assert.equal(w, '1200', 'expected og:image:width=1200');
  assert.equal(h, '630', 'expected og:image:height=630');
});

test('/sleep-quiz emits matching twitter:image (Phase 188 + inheritance)', async () => {
  const res = await fetchHtml('/sleep-quiz');
  const twImage = res.$('meta[name="twitter:image"]').attr('content') ?? '';
  assert.ok(
    twImage.includes('/opengraph-image'),
    `expected twitter:image to mirror og:image on /sleep-quiz, got: ${twImage}`,
  );
});
