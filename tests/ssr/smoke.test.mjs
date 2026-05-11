/**
 * Smoke test — the homepage and the sleep-quiz route render 200 with a
 * non-empty <title>. The narrowest "the server is up and Next.js is
 * routing correctly" check, used to keep the test suite from passing
 * vacuously when none of the meatier suites can run.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200 } from './_helpers.mjs';

test('homepage renders 200 with a title', async () => {
  const res = await fetchHtml('/');
  expect200(res, '/');
  const title = res.$('title').first().text().trim();
  assert.ok(title.length > 0, `expected a non-empty <title> on /, got "${title}"`);
});

test('sleep-quiz renders 200 with a title', async () => {
  const res = await fetchHtml('/sleep-quiz');
  expect200(res, '/sleep-quiz');
  const title = res.$('title').first().text().trim();
  assert.ok(title.length > 0, `expected a non-empty <title> on /sleep-quiz, got "${title}"`);
});
