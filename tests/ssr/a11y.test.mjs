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

test('homepage hero h1 has a normalized aria-label (Phase 174)', async () => {
  const res = await fetchHtml('/');
  expect200(res, '/');
  // Phase 174 normalized the multi-line slide title (split by `\n`
  // into spans) into a single-line aria-label so SR reads
  // "Try before you buy." not "Try beforeyou buy."
  const h1 = res.$('section.hero h1.hero-title');
  assert.equal(h1.length >= 1, true, 'expected at least one hero h1');
  // Take the first (slide 0 / active)
  const label = h1.first().attr('aria-label') ?? '';
  assert.ok(
    label.length > 0,
    `expected non-empty aria-label on hero h1, got: "${label}"`,
  );
  // No newline / no double-space anomalies (Phase 174 contract).
  assert.ok(
    !label.includes('\n'),
    `hero h1 aria-label should be normalized (no \\n), got: "${label}"`,
  );
  assert.ok(
    !/\s{2,}/.test(label),
    `hero h1 aria-label should not have run-together words, got: "${label}"`,
  );
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
