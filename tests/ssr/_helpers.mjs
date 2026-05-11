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
