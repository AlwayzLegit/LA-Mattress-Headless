/**
 * Hero carousel SSR shape — protects Phase 195 (server-shell + client
 * controller split) and Phase 162 (per-slide image deferral).
 *
 * The hero went from a 'use client' monolith to a server-rendered
 * <section.hero> that emits all 3 slide DOMs as static HTML, with
 * slide 0 marked `.on` and focusable, and slides 1+2 marked
 * `aria-hidden="true"` and `inert`. The client controller mounts
 * after hydration and updates these attributes via querySelector.
 *
 * These tests validate the *initial* HTML — the contract the server
 * shell exposes. Anything the controller does post-hydration
 * (rotation, focus management, hover-pause) requires a browser and
 * is out of scope.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200 } from './_helpers.mjs';

test('homepage <section.hero> exists with carousel a11y attrs', async () => {
  const res = await fetchHtml('/');
  expect200(res, '/');
  const hero = res.$('section.hero');
  assert.equal(hero.length, 1, 'expected exactly one <section.hero> on /');
  assert.equal(
    hero.attr('aria-roledescription'),
    'carousel',
    'expected aria-roledescription="carousel"',
  );
  const label = hero.attr('aria-label');
  assert.ok(label && label.length > 0, 'expected non-empty aria-label on .hero');
});

test('hero emits exactly 3 [data-hero-slide] elements', async () => {
  const res = await fetchHtml('/');
  const slides = res.$('[data-hero-slide]');
  assert.equal(
    slides.length,
    3,
    `expected 3 [data-hero-slide] elements (HERO_SLIDES.length), got ${slides.length}`,
  );
});

test('hero slide 0 is active (.on, not aria-hidden, not inert)', async () => {
  const res = await fetchHtml('/');
  const slide0 = res.$('[data-hero-slide="0"]');
  assert.equal(slide0.length, 1, 'expected slide 0 to exist');
  assert.ok(
    slide0.hasClass('on'),
    `expected slide 0 to have .on class, classes were: ${slide0.attr('class')}`,
  );
  assert.notEqual(
    slide0.attr('aria-hidden'),
    'true',
    'slide 0 should NOT be aria-hidden',
  );
  // `inert` is a boolean attribute — presence (any value including
  // empty string) means inert. Check the attribute is absent.
  assert.equal(
    slide0.attr('inert'),
    undefined,
    'slide 0 should NOT have inert attribute',
  );
});

test('hero slides 1 and 2 are inactive (aria-hidden + inert, no .on)', async () => {
  const res = await fetchHtml('/');
  for (const idx of [1, 2]) {
    const slide = res.$(`[data-hero-slide="${idx}"]`);
    assert.equal(slide.length, 1, `expected slide ${idx} to exist`);
    assert.ok(
      !slide.hasClass('on'),
      `slide ${idx} should NOT have .on class, classes: ${slide.attr('class')}`,
    );
    assert.equal(
      slide.attr('aria-hidden'),
      'true',
      `slide ${idx} should be aria-hidden="true"`,
    );
    // inert attribute should be present (boolean attribute renders as
    // inert="" or similar)
    assert.notEqual(
      slide.attr('inert'),
      undefined,
      `slide ${idx} should have inert attribute set`,
    );
  }
});

test('hero slide 0 SSR-renders its <img>; slides 1+2 do not (Phase 162 deferral)', async () => {
  const res = await fetchHtml('/');
  const slide0Img = res.$('[data-hero-slide="0"] .hero-bg img').length;
  assert.equal(
    slide0Img,
    1,
    `slide 0 should SSR exactly one <img> (LCP candidate), found ${slide0Img}`,
  );
  for (const idx of [1, 2]) {
    const imgCount = res.$(`[data-hero-slide="${idx}"] .hero-bg img`).length;
    assert.equal(
      imgCount,
      0,
      `slide ${idx} should NOT SSR an <img> (mounts after hydration), found ${imgCount}`,
    );
  }
});

test('hero controller mounts 3 dot buttons + counter readout', async () => {
  const res = await fetchHtml('/');
  const dots = res.$('.hero-progress .hero-dot');
  assert.equal(
    dots.length,
    3,
    `expected 3 .hero-dot buttons, got ${dots.length}`,
  );
  // First dot is active (tabIndex={0}), others -1 — but cheerio's
  // `tabindex` attr serialization may vary. Just check the active
  // one's aria-current.
  const activeDot = res.$('.hero-dot.on');
  assert.equal(activeDot.length, 1, 'exactly one .hero-dot should be .on');
  assert.equal(
    activeDot.attr('aria-current'),
    'true',
    'active dot should have aria-current="true"',
  );
  // Counter readout — Phase 90 added the NN/NN counter
  const counter = res.$('.hero-counter').text();
  assert.match(
    counter,
    /01\s*\/\s*03/,
    `expected counter to show "01 / 03", got "${counter}"`,
  );
});
