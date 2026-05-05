#!/usr/bin/env node
/**
 * pull-articles-via-storefront.mjs — Pull article handles per blog from the
 * Storefront API. Uses the existing public token (no Admin API needed).
 *
 * Why Storefront when pull-inventory.mjs uses Admin: Storefront *does* expose
 * blog articles (just not URL redirects). For article handles alone, the
 * public Storefront token is enough — no Admin scope juggling required.
 *
 * Output: rewrites data/url-inventory/blogs.json keeping the existing blog
 * metadata and replacing the empty articles[] arrays with real handles.
 *
 * Re-runnable. Idempotent. Reads SHOPIFY_STORE_DOMAIN +
 * SHOPIFY_STOREFRONT_PUBLIC_TOKEN from .env.local.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

async function loadEnvLocal() {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, '..', '.env.local');
  try {
    const raw = await readFile(path, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* ignore — env may already be set */ }
}

await loadEnvLocal();
const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? '2024-10';
if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_PUBLIC_TOKEN');
  process.exit(1);
}
const ENDPOINT = `https://${STORE}/api/${VERSION}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors && !json.data) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function pullArticles(blogHandle) {
  const Q = `
    query As($handle: String!, $first: Int!, $after: String) {
      blog(handle: $handle) {
        articles(first: $first, after: $after) {
          edges { node { id handle title publishedAt } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`;
  const out = [];
  let after = null;
  let safety = 50;
  while (safety-- > 0) {
    const d = await gql(Q, { handle: blogHandle, first: 250, after });
    if (!d?.blog) return out;
    const conn = d.blog.articles;
    out.push(
      ...conn.edges.map((e) => ({
        handle: e.node.handle,
        // Storefront API doesn't expose isPublished — only published articles
        // are returned at all, so isPublished is always true.
        isPublished: true,
        publishedAt: e.node.publishedAt,
        // Storefront uses string IDs (gid://). Match the existing shape.
        id: e.node.id,
        title: e.node.title,
      })),
    );
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const blogsPath = resolve(here, '..', 'data', 'url-inventory', 'blogs.json');
  const existing = JSON.parse(await readFile(blogsPath, 'utf8'));

  const blogs = existing.blogs ?? [];
  console.log(`Pulling articles for ${blogs.length} blogs from ${STORE}...`);

  for (const blog of blogs) {
    const articles = await pullArticles(blog.handle);
    blog.articles = articles;
    console.log(`  ${blog.handle.padEnd(28)} ${articles.length} articles`);
  }

  const updated = {
    ...existing,
    $pulledAt: new Date().toISOString(),
    $source: `Shopify Storefront API (${STORE}) via scripts/pull-articles-via-storefront.mjs`,
    $count: blogs.length,
    blogs,
  };
  await writeFile(blogsPath, JSON.stringify(updated, null, 2) + '\n');
  console.log(`\nWrote ${blogsPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
