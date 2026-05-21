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

// ClickHouse / pseudo-ClickHouse function names that look HogQL-compatible
// but aren't. Two confirmed-broken classes:
//
//   1. Width-suffixed Int conversions (`toInt32OrNull` etc.) — first
//      caught in PR #225 from Sentry LA-MATTRESS-HEADLESS-Q.
//   2. Bare `toIntOrNull` — what PR #225 swapped in as a fix, also
//      rejected by HogQL (Sentry LA-MATTRESS-HEADLESS-S, QA round 2).
//
// `toFloatOrZero` IS valid HogQL (PR #225's fix to the parallel float
// query worked), so we DON'T blanket-ban every `to*OrZero/Null` variant.
// Add to this list only what's been observed broken in the wild.
//
// Pattern that's safe when you need to compare a JSON property to an
// integer: avoid conversion entirely. `properties.X` access auto-types,
// and string-compare via `toString(properties.X) = '0'` is bulletproof.
const BANNED_HOGQL_FUNCTIONS = [
  'toInt8OrNull', 'toInt16OrNull', 'toInt32OrNull', 'toInt64OrNull',
  'toInt8OrZero', 'toInt16OrZero', 'toInt32OrZero', 'toInt64OrZero',
  'toFloat32OrZero', 'toFloat64OrZero',
  'toFloat32OrNull', 'toFloat64OrNull',
  // QA round 2 (Sentry LA-MATTRESS-HEADLESS-S): the bare non-suffixed
  // version of toIntOrNull is ALSO unsupported. Banned alongside the
  // width-suffixed variants — same fix class.
  'toIntOrNull',
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

/* ------------------------------------------------------------------------ *
 * Allow-list lint — every HogQL function call must be on the verified list.
 *
 * The deny-list above catches the SPECIFIC broken names we've seen ship.
 * It does NOT catch the NEXT class of bug — a different ClickHouse-named
 * function someone copy-pastes that happens to not be on either list.
 * Cowork 20260521 follow-up: flip the model. Maintain an allow-list of
 * HogQL functions we've confirmed work, and CI rejects any HogQL call
 * site using a function not on that list.
 *
 * Adding a function to the allow-list = signaling "I've run this against
 * the actual PostHog Query API and it returned data, not a 400". That
 * gate keeps the next round of "I assumed this exists" out of prod.
 * ------------------------------------------------------------------------ */

const ALLOWED_HOGQL_FUNCTIONS = new Set([
  // Aggregates verified in current queries
  'count', 'countIf', 'sum', 'argMin',
  // Conversion / nulls — only what's known to work. Notable absentees:
  // toIntOrNull (proven broken — see deny-list), and ALL width-suffixed
  // variants (toInt32OrNull, toFloat64OrZero, …).
  'toString', 'toFloatOrZero', 'coalesce', 'nullif',
  // Math
  'round',
  // String — used by getTopSearches to normalize the query key.
  'lower', 'trim', 'startsWith',
  // Time
  'now',
]);

// SQL keywords + names that match `\w+\(` syntactically but aren't
// function calls in HogQL — these get filtered out before the allow-
// list check fires. Add (lowercased) here when extending HogQL feature
// coverage triggers a false positive.
const SQL_KEYWORDS_LOOKING_LIKE_FUNCTIONS = new Set([
  'if', 'case', 'when', 'then', 'else', 'end',
  'with', 'as', 'and', 'or', 'not', 'in', 'is', 'null',
  'distinct', 'select', 'from', 'where', 'group', 'order', 'by',
  'limit', 'having', 'on', 'join', 'left', 'right', 'inner', 'outer',
  'interval', 'day', 'hour', 'minute', 'second', 'week', 'month',
  'true', 'false', 'cast', 'over', 'partition', 'rows', 'between',
]);

function extractHogqlFunctionNames(hogqlString) {
  const matches = hogqlString.matchAll(/\b([A-Za-z_]\w*)\s*\(/g);
  const names = new Set();
  for (const m of matches) {
    const name = m[1];
    if (!SQL_KEYWORDS_LOOKING_LIKE_FUNCTIONS.has(name.toLowerCase())) {
      names.add(name);
    }
  }
  return names;
}

test('every HogQL function call in posthog-dashboard.ts is on the allow-list', async () => {
  const source = await readFile(resolve(REPO_ROOT, 'lib/posthog-dashboard.ts'), 'utf8');
  // Extract every hogQL`...` template literal body.
  const hogqlMatches = source.matchAll(/hogQL\(\s*`([\s\S]*?)`/g);
  const usedFunctions = new Set();
  const callSites = new Map(); // name → first snippet for error context
  for (const m of hogqlMatches) {
    const body = m[1];
    for (const name of extractHogqlFunctionNames(body)) {
      usedFunctions.add(name);
      if (!callSites.has(name)) {
        // First 80 chars of the surrounding HogQL for error message.
        const idx = body.search(new RegExp(`\\b${name}\\s*\\(`));
        callSites.set(name, body.slice(Math.max(0, idx - 20), idx + 60).replace(/\s+/g, ' '));
      }
    }
  }
  const offenders = [...usedFunctions].filter((fn) => !ALLOWED_HOGQL_FUNCTIONS.has(fn));
  assert.equal(
    offenders.length,
    0,
    offenders.length === 0
      ? ''
      : `HogQL function(s) not on the allow-list: ${offenders.map((n) => `"${n}"`).join(', ')}\n\n` +
        offenders.map((n) => `  ${n}: …${callSites.get(n)}…`).join('\n') + '\n\n' +
        `If this function genuinely works in PostHog HogQL, add it to ` +
        `ALLOWED_HOGQL_FUNCTIONS in tests/ssr/lib-posthog-hogql-lint.test.mjs ` +
        `and document the verification. If you guessed (a ClickHouse name, ` +
        `a SQL name from another dialect), pick a verified alternative — see ` +
        `Sentry LA-MATTRESS-HEADLESS-S for the cost of getting this wrong.`,
  );
});
