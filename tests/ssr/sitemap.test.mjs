/**
 * Sitemap contract tests (HTTP-level, audit codeq-test-gaps-02 +
 * seo-tech-03). Fetches the served /sitemap.xml from the dev server and
 * pins the three invariants regressions here actually cost rankings on:
 *
 *  1. Every URL is on the canonical www host (the apex/www split of
 *     audit seo-organic-03 must never come from our own sitemap).
 *  2. No URL is a redirect source — the sitemap advertising 301ing
 *     URLs is a documented past SEMrush failure ("Incorrect pages
 *     found in sitemap.xml").
 *  3. The beds-mattresses archive (72 live articles, re-included in
 *     the /blogs hub by PR #494) is present again: sitemap policy and
 *     link-graph policy must agree (audit seo-tech-03).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const BASE = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRedirectSources() {
  const root = resolve(__dirname, '..', '..');
  const sources = new Set();
  for (const file of ['redirects.json', 'redirects-manual.json']) {
    const d = JSON.parse(readFileSync(resolve(root, 'data/url-inventory', file), 'utf8'));
    for (const r of d.redirects ?? []) if (r.source) sources.add(r.source.replace(/\/+$/, '') || '/');
  }
  return sources;
}

async function fetchSitemapUrls() {
  const res = await fetch(`${BASE}/sitemap.xml`);
  assert.equal(res.status, 200, 'sitemap.xml should serve 200');
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length > 100, `expected a real sitemap, got ${urls.length} URLs`);
  return urls;
}

test('every sitemap URL is on the canonical www host', async () => {
  const urls = await fetchSitemapUrls();
  const offHost = urls.filter((u) => !u.startsWith('https://www.mattressstoreslosangeles.com/') && u !== 'https://www.mattressstoreslosangeles.com');
  assert.deepEqual(offHost.slice(0, 5), [], `${offHost.length} URLs off the www host`);
});

test('no sitemap URL is a redirect source', async () => {
  const urls = await fetchSitemapUrls();
  const sources = loadRedirectSources();
  const advertised = urls
    .map((u) => new URL(u).pathname.replace(/\/+$/, '') || '/')
    .filter((path) => sources.has(path));
  assert.deepEqual(advertised.slice(0, 5), [], `${advertised.length} redirect-source URLs advertised in sitemap`);
});

test('beds-mattresses archive is back in the sitemap (policy agrees with /blogs hub)', async () => {
  const urls = await fetchSitemapUrls();
  const index = urls.filter((u) => u.endsWith('/blogs/beds-mattresses'));
  const articles = urls.filter((u) => u.includes('/blogs/beds-mattresses/'));
  assert.equal(index.length, 1, 'blog index should be listed exactly once');
  assert.ok(
    articles.length >= 50,
    `expected the ~72 live archive articles, got ${articles.length}`,
  );
});
