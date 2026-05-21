/**
 * Static-analysis test for HogQL queries in lib/posthog-dashboard.ts
 * and lib/posthog-query.ts.
 *
 * Background: PR #224 shipped queries containing the ClickHouse-native
 * function variants `toInt32OrNull` and `toFloat64OrZero`. PostHog's
 * HogQL dialect doesn't expose the int-width-suffixed forms — only
 * the width-agnostic `toIntOrNull` / `toFloatOrZero`. The result was
 * silent HTTP 400s captured by the no-throws fetcher; three cards
 * rendered "data unavailable" in production for hours before QA
 * caught it.
 *
 * Hard to write a true execution-level test for this class of bug
 * without standing up a PostHog mock that parses HogQL. But it's
 * cheap to read the source files as text and reject the offending
 * substrings outright. If anyone tries to reintroduce them (e.g.,
 * by copy-pasting a ClickHouse snippet), this test fires before
 * the change can reach prod.
 *
 * If PostHog ever adds support for these in HogQL, drop the banned
 * token from the list. Until then, treat this file as the line of
 * defense between a Sentry 400 storm and the merchant's dashboard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

// ClickHouse-native function names that look HogQL-compatible but
// aren't. The PostHog error message points at the right replacement
// for each — kept in this comment so the fix is one keystroke away
// if a CI failure surfaces a new query containing one of these.
//
//   toInt8OrNull   → toIntOrNull       toInt8OrZero   → (no direct equivalent; use toIntOrNull + coalesce 0)
//   toInt16OrNull  → toIntOrNull       toInt16OrZero  → likewise
//   toInt32OrNull  → toIntOrNull       toInt32OrZero  → likewise
//   toInt64OrNull  → toIntOrNull       toInt64OrZero  → likewise
//   toFloat32OrZero → toFloatOrZero
//   toFloat64OrZero → toFloatOrZero
//   toFloat32OrNull → toFloatOrNull
//   toFloat64OrNull → toFloatOrNull
const BANNED_HOGQL_FUNCTIONS = [
  'toInt8OrNull', 'toInt16OrNull', 'toInt32OrNull', 'toInt64OrNull',
  'toInt8OrZero', 'toInt16OrZero', 'toInt32OrZero', 'toInt64OrZero',
  'toFloat32OrZero', 'toFloat64OrZero',
  'toFloat32OrNull', 'toFloat64OrNull',
];

// Files whose source must not contain any banned function token. Add
// new HogQL-emitting modules here as they're created.
const FILES_TO_CHECK = [
  'lib/posthog-dashboard.ts',
  'lib/posthog-query.ts',
];

for (const relPath of FILES_TO_CHECK) {
  test(`${relPath} contains no banned ClickHouse-only function names`, async () => {
    const absPath = resolve(REPO_ROOT, relPath);
    const source = await readFile(absPath, 'utf8');
    for (const banned of BANNED_HOGQL_FUNCTIONS) {
      assert.equal(
        source.includes(banned),
        false,
        `Found banned HogQL function "${banned}" in ${relPath}. ` +
          `PostHog's HogQL dialect doesn't expose int/float-width-suffixed variants. ` +
          `Replace with the width-agnostic form (toIntOrNull / toFloatOrZero / etc.). ` +
          `See PR #225 for the prior occurrence.`,
      );
    }
  });
}

test('lib/shopify/admin.ts tags every adminGql call with "admin-dashboard"', async () => {
  // The refresh button (PR #226) calls revalidateTag('admin-dashboard')
  // to bust the Shopify Data Cache. If a future adminGql query forgets
  // the tag, the refresh button silently stops working for that query.
  //
  // Lightweight check: every call to adminGql in admin.ts must be
  // backed by a fetch() that includes `tags: ['admin-dashboard']`. The
  // current implementation centralizes the tag inside adminGql(), so
  // this collapses to "the adminGql function body must include the
  // tag string." A bigger refactor would split into per-call tags;
  // we're not there yet.
  const source = await readFile(resolve(REPO_ROOT, 'lib/shopify/admin.ts'), 'utf8');
  assert.match(
    source,
    /tags:\s*\[\s*['"]admin-dashboard['"]/,
    'adminGql() must include `tags: [\'admin-dashboard\']` in its fetch ' +
      'options so the dashboard refresh button can bust its cache.',
  );
});
