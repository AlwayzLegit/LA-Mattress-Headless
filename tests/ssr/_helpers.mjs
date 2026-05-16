/**
 * Shared helpers for SSR tests. Each test file imports `fetchHtml(path)`
 * to GET a page from the dev server and parse the HTML with cheerio.
 *
 * `TEST_BASE_URL` is injected by tests/run.mjs (defaults to
 * http://127.0.0.1:3100 in case a test file is run directly).
 */

import * as cheerio from 'cheerio';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3100';

/**
 * Phase 203: signals whether Shopify-dependent routes are testable in
 * this environment. The `app/products/[handle]`, `app/collections/[handle]`,
 * `app/blogs/[blog]/[article]`, and `app/pages/[handle]` route templates
 * all call `notFound()` when these env vars are missing
 * (`SHOPIFY_CONFIGURED` in their page.tsx files), so any assertion
 * against those routes would 404. Test files use this to skip
 * gracefully:
 *
 *   import { test } from 'node:test';
 *   import { fetchHtml, SHOPIFY_SKIP } from './_helpers.mjs';
 *
 *   test('product LD has @id', { skip: SHOPIFY_SKIP }, async () => { ... });
 *
 * CI passes without secrets (tests skip with a clear message). Once
 * `SHOPIFY_STORE_DOMAIN` + `SHOPIFY_STOREFRONT_PUBLIC_TOKEN` are added
 * to GitHub Actions secrets, the workflow forwards them to `next dev`
 * and these tests start running for real.
 */
export const SHOPIFY_CONFIGURED = Boolean(
  process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
);
export const SHOPIFY_SKIP = SHOPIFY_CONFIGURED
  ? false
  : 'Shopify env vars not set — SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_PUBLIC_TOKEN required';

/**
 * Fetch a path on the test server and return a cheerio document plus
 * the raw response. Throws on non-200 / non-404 (we want test failures
 * to be loud).
 */
export async function fetchHtml(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'la-mattress-ssr-test' },
  });
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    text,
    $: cheerio.load(text),
  };
}

/**
 * Convenience — assert the fetched page is 200 OK.
 */
export function expect200(res, path) {
  if (res.status !== 200) {
    throw new Error(`Expected 200 from ${path}, got ${res.status}.\n--- body (first 500 chars) ---\n${res.text.slice(0, 500)}`);
  }
}

/**
 * Parse a JSON-LD <script> tag's contents into an object. Throws with
 * the script ID in the message if the JSON is malformed (rare — Next
 * stringifies via `JSON.stringify`, but worth a clear error for the
 * cheerio-traversal happy path).
 */
export function parseJsonLd($, scriptId) {
  const raw = $(`script#${scriptId}[type="application/ld+json"]`).text();
  if (!raw) {
    throw new Error(`No <script id="${scriptId}" type="application/ld+json"> found`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in #${scriptId}: ${err instanceof Error ? err.message : err}`);
  }
}

