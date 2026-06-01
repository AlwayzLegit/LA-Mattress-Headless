/**
 * Phase 308 SEO PR — collection title overrides.
 *
 * Covers the per-handle SEO override layer in
 * `lib/collection-seo-overrides.ts`. The override wins over both the
 * merchant's `collection.seo.title` and the
 * `${collection.title} | LA Mattress Store` fallback, and is applied
 * inside `app/(storefront)/collections/[handle]/page.tsx`
 * generateMetadata.
 *
 * Target handle: `tempur-pedic-mattresses` — Semrush 20260530 flagged
 * the live title for missing the "Tempur Pedic" (two-words, no-hyphen)
 * search variant. The override (added in this PR) replaces the
 * merchant-authored title with one that carries all three brand-name
 * spellings users actually search for.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200, SHOPIFY_SKIP } from './_helpers.mjs';
import {
  COLLECTION_SEO_OVERRIDES,
  getCollectionSeoOverride,
} from '../../lib/collection-seo-overrides.ts';

test('getCollectionSeoOverride() returns undefined for unconfigured handles', () => {
  assert.equal(getCollectionSeoOverride('not-a-real-handle'), undefined);
});

test('tempur-pedic-mattresses override carries all three brand spellings', () => {
  const override = getCollectionSeoOverride('tempur-pedic-mattresses');
  assert.ok(override?.title, 'expected tempur-pedic-mattresses to have a title override');
  // All three spellings users search for must be present, since
  // covering them is the entire reason this override exists.
  for (const variant of ['Tempur-Pedic', 'Tempur Pedic', 'Tempurpedic']) {
    assert.ok(
      override.title.includes(variant),
      `tempur-pedic override should carry "${variant}", got: "${override.title}"`,
    );
  }
  // Stay under the SERP truncation threshold (~70 chars).
  assert.ok(
    override.title.length <= 70,
    `override title length ${override.title.length} exceeds SERP truncation (70)`,
  );
  // Brand suffix present so the title reads as ours, not the brand's.
  assert.ok(
    /\|\s*LA Mattress/i.test(override.title),
    `override title should end with " | LA Mattress" brand suffix`,
  );
});

test('size-PLP h1 overrides carry the "size" head-keyword token', () => {
  // Semrush 20260601 "Ideas": these size PLPs render H1s from the
  // merchant title ("King Mattresses") which drops the "size" the head
  // query carries ("king size mattress"). The h1 override restores it.
  for (const handle of [
    'king-size-mattresses',
    'queen-size-mattresses',
    'twin-size-mattresses',
    'full-size-mattresses',
  ]) {
    const override = getCollectionSeoOverride(handle);
    assert.ok(override?.h1, `expected an h1 override for "${handle}"`);
    assert.ok(
      /\bsize\b/i.test(override.h1),
      `h1 override for "${handle}" should contain "size", got: "${override.h1}"`,
    );
  }
});

test('every override stays under SERP truncation thresholds', () => {
  for (const [handle, override] of Object.entries(COLLECTION_SEO_OVERRIDES)) {
    if (override.title) {
      assert.ok(
        override.title.length <= 70,
        `title override for "${handle}" is ${override.title.length} chars (>70 truncation)`,
      );
    }
    if (override.description) {
      assert.ok(
        override.description.length <= 158,
        `description override for "${handle}" is ${override.description.length} chars (>158 truncation)`,
      );
    }
  }
});

test('/collections/tempur-pedic-mattresses serves the override title', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml('/collections/tempur-pedic-mattresses');
  expect200(res, '/collections/tempur-pedic-mattresses');
  const title = res.$('title').text();
  const override = getCollectionSeoOverride('tempur-pedic-mattresses');
  assert.equal(
    title,
    override?.title,
    `expected override title on /collections/tempur-pedic-mattresses, got: "${title}"`,
  );
});
