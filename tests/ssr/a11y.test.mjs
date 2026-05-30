/**
 * A11y SSR attribute regressions — protects Phase 190 (sleep-quiz
 * fieldset describedby), Phase 174 (hero h1 aria-label normalization),
 * Phase 172/173 (breadcrumb nav aria-label).
 *
 * Limitations: anything that only appears AFTER client-side interaction
 * (cart drawer open, search overlay, mega menu focus shift) can't be
 * tested at the SSR level. Those need a browser — see PR #53 / #54
 * sign-off for code-level review of those phases.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200 } from './_helpers.mjs';

test('/sleep-quiz fieldset links helper text via aria-describedby (Phase 190)', async () => {
  const res = await fetchHtml('/sleep-quiz');
  expect200(res, '/sleep-quiz');
  // Phase 190 added id="quiz-question-helper" on the helper <p> and
  // aria-describedby on the fieldset (conditional on q.helper).
  // Q0 (`position`) has helper text, so the SSR HTML for step 0
  // should include both.
  const helper = res.$('p#quiz-question-helper');
  assert.equal(
    helper.length,
    1,
    'expected the helper <p id="quiz-question-helper"> on /sleep-quiz step 0',
  );
  const fieldset = res.$('fieldset.quiz-step');
  assert.equal(
    fieldset.attr('aria-describedby'),
    'quiz-question-helper',
    'fieldset should describe the helper paragraph via aria-describedby (Phase 190)',
  );
  // Also verify the legend/radiogroup linkage that pre-dated the
  // describedby fix — regression guard for both.
  const radiogroup = res.$('[role="radiogroup"]');
  assert.equal(
    radiogroup.attr('aria-labelledby'),
    'quiz-question-title',
    'radiogroup should aria-labelledby the legend',
  );
});

test('homepage hero slide title has a normalized aria-label (Phase 174 / 308)', async () => {
  const res = await fetchHtml('/');
  expect200(res, '/');
  // Phase 174 normalized the multi-line slide title (split by `\n`
  // into spans) into a single-line aria-label so SR reads
  // "Try before you buy." not "Try beforeyou buy."
  //
  // Phase 308: every hero slide now renders as `<p class="hero-title">`
  // rather than slide 0 being `<h1>`. The canonical homepage <h1> is a
  // visually-hidden element above the hero (see the
  // 'homepage canonical h1 is keyword-loaded' test below). The Phase
  // 174 normalization contract still applies to the slide title's
  // aria-label, just now on the <p> tag.
  const titles = res.$('section.hero p.hero-title');
  assert.equal(titles.length >= 1, true, 'expected at least one hero p.hero-title');
  const label = titles.first().attr('aria-label') ?? '';
  assert.ok(
    label.length > 0,
    `expected non-empty aria-label on hero slide title, got: "${label}"`,
  );
  // No newline / no double-space anomalies (Phase 174 contract).
  assert.ok(
    !label.includes('\n'),
    `hero slide aria-label should be normalized (no \\n), got: "${label}"`,
  );
  assert.ok(
    !/\s{2,}/.test(label),
    `hero slide aria-label should not have run-together words, got: "${label}"`,
  );
});

test('homepage canonical h1 is keyword-loaded and visually hidden (Phase 308)', async () => {
  const res = await fetchHtml('/');
  expect200(res, '/');
  // Phase 308 SEO audit (Semrush 20260530): the homepage <h1> moved
  // from hero slide 0's title (which came from a merchant-editable
  // Shopify metaobject and was missing all four target keywords) to a
  // code-controlled visually-hidden <h1> at the top of <main>. The
  // page should have exactly one <h1>, it should be the .sr-only one,
  // and it should carry the four homepage target keywords.
  const h1 = res.$('h1');
  assert.equal(h1.length, 1, `expected exactly one h1 on /, got ${h1.length}`);
  assert.ok(
    (h1.attr('class') ?? '').includes('sr-only'),
    `homepage h1 should be visually hidden (.sr-only)`,
  );
  const text = h1.text().toLowerCase();
  // All four Semrush-tracked homepage target keywords.
  for (const kw of ['mattress store', 'los angeles', 'shop mattresses', 'mattress sales']) {
    assert.ok(text.includes(kw), `h1 should contain "${kw}", got: "${h1.text()}"`);
  }
});

test('homepage breadcrumb-style navs each carry aria-label', async () => {
  const res = await fetchHtml('/');
  // Phase 173 added breadcrumb aria-label across templates — homepage
  // doesn't have a breadcrumb itself, but the locations / quiz / blog
  // templates do. Spot-check on /sleep-quiz instead.
  const quiz = await fetchHtml('/sleep-quiz');
  const crumbNav = quiz.$('nav.lp-breadcrumbs[aria-label="Breadcrumb"]');
  assert.equal(
    crumbNav.length,
    1,
    'expected <nav.lp-breadcrumbs aria-label="Breadcrumb"> on /sleep-quiz',
  );
});
