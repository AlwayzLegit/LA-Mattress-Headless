#!/usr/bin/env node
/**
 * pull-inventory.mjs — Snapshot the live storefront's URL inventory.
 *
 * Reads from Shopify Admin GraphQL and writes:
 *   data/url-inventory/collections.json   — every collection (handle + SEO)
 *   data/url-inventory/products.json      — every active+published product
 *   data/url-inventory/pages.json         — every published Page
 *   data/url-inventory/blogs.json         — every blog + its published articles
 *   data/url-inventory/redirects.json     — every URL redirect (path → target)
 *   data/url-inventory/redirects.csv      — same, in Shopify Admin import format
 *
 * Why Admin and not Storefront API: the Storefront API doesn't expose URL
 * redirects, and Admin gives us per-resource publication status which is what
 * we need to know whether each handle has a live URL.
 *
 * This is a one-shot reads-only script. No writes back to Shopify.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
 *     node scripts/pull-inventory.mjs
 *
 * Required Admin scopes: read_products, read_content (Pages/Blogs/Articles),
 * read_online_store_pages, read_themes (for redirects).
 *
 * Re-run whenever the catalog changes. Output is checked into the repo so the
 * Next.js app can use it for generateStaticParams + sitemap generation
 * without hitting Shopify on every build.
 *
 * Required Admin scopes (Shopify Admin → Settings → Apps and sales channels
 * → Develop apps → [your app] → Configuration → Admin API access scopes):
 *
 *   read_products              — products + variants
 *   read_content               — articles, blogs, comments
 *   read_online_store_pages    — Shopify Pages (the /pages/X routes)
 *   read_online_store_navigation
 *                              — URL redirects (renamed scope; in 2024-10
 *                                Shopify moved urlRedirects out of
 *                                read_themes into the dedicated
 *                                read_online_store_navigation scope per
 *                                the GraphQL Admin API reference). The
 *                                script gracefully skips redirects +
 *                                preserves the existing redirects.json
 *                                if this scope is missing, so the pull
 *                                still succeeds.
 *
 * read_themes is NOT required despite older guidance saying so — redirects
 * moved to read_online_store_navigation in 2024-10.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = '2024-10';

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN');
  process.exit(1);
}

const ENDPOINT = `https://${STORE}/admin/api/${VERSION}/graphql.json`;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'url-inventory');

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function paginate(queryFn) {
  const all = [];
  let after;
  let safety = 200;
  while (safety-- > 0) {
    const { edges, pageInfo } = await queryFn(after);
    all.push(...edges.map((e) => e.node));
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }
  return all;
}

async function pullCollections() {
  const Q = `
    query Cs($first: Int!, $after: String) {
      collections(first: $first, after: $after, sortKey: ID) {
        edges { node {
          id handle title updatedAt
          productsCount { count }
          seo { title description }
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  const nodes = await paginate(async (after) => {
    const d = await gql(Q, { first: 50, after });
    return d.collections;
  });
  return nodes.map((n) => ({
    handle: n.handle,
    id: n.id,
    title: n.title,
    productsCount: n.productsCount?.count ?? null,
    updatedAt: n.updatedAt,
    seoTitle: n.seo?.title ?? null,
    seoDescription: n.seo?.description ?? null,
  }));
}

async function pullProducts() {
  const Q = `
    query Ps($first: Int!, $after: String) {
      products(
        first: $first, after: $after, sortKey: ID,
        query: "status:active AND published_status:online_store_channel"
      ) {
        edges { node {
          id handle title vendor productType
          updatedAt publishedAt
          seo { title description }
          featuredImage { url }
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  const nodes = await paginate(async (after) => {
    const d = await gql(Q, { first: 50, after });
    return d.products;
  });
  return nodes.map((n) => ({
    handle: n.handle,
    id: n.id,
    title: n.title,
    vendor: n.vendor,
    productType: n.productType,
    publishedAt: n.publishedAt,
    updatedAt: n.updatedAt,
    seoTitle: n.seo?.title ?? null,
    seoDescription: n.seo?.description ?? null,
    featuredImage: n.featuredImage?.url ?? null,
  }));
}

async function pullPages() {
  const Q = `
    query Pgs($first: Int!, $after: String) {
      pages(first: $first, after: $after) {
        edges { node {
          id handle title isPublished publishedAt updatedAt
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  const nodes = await paginate(async (after) => {
    const d = await gql(Q, { first: 50, after });
    return d.pages;
  });
  return nodes.map((n) => ({
    handle: n.handle,
    id: n.id,
    title: n.title,
    isPublished: n.isPublished,
    publishedAt: n.publishedAt,
    updatedAt: n.updatedAt,
  }));
}

async function pullBlogs() {
  // Step 1: list blogs
  const QB = `
    query Bs($first: Int!, $after: String) {
      blogs(first: $first, after: $after) {
        edges { node { id handle title updatedAt } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  const blogs = await paginate(async (after) => {
    const d = await gql(QB, { first: 50, after });
    return d.blogs;
  });

  // Step 2: per blog, fetch articles
  const QA = `
    query As($id: ID!, $first: Int!, $after: String) {
      blog(id: $id) {
        articles(first: $first, after: $after) {
          edges { node { id handle title isPublished publishedAt updatedAt } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`;
  const out = [];
  for (const b of blogs) {
    const articles = [];
    let after;
    let safety = 200;
    while (safety-- > 0) {
      const d = await gql(QA, { id: b.id, first: 50, after });
      const conn = d.blog?.articles;
      if (!conn) break;
      articles.push(...conn.edges.map((e) => e.node));
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    out.push({
      handle: b.handle,
      id: b.id,
      title: b.title,
      updatedAt: b.updatedAt,
      articles: articles.map((a) => ({
        handle: a.handle,
        id: a.id,
        title: a.title,
        isPublished: a.isPublished,
        publishedAt: a.publishedAt,
        // updatedAt bumps whenever the article body / SEO / tags are
        // edited — even without a republish. The sitemap reads this as
        // the lastmod signal so edits to live articles get re-crawled
        // promptly. Without it, sitemap lastmod stays pinned to
        // publishedAt and post-publish edits stay invisible to crawlers
        // until the next URL is found organically.
        updatedAt: a.updatedAt,
      })),
    });
  }
  return out;
}

async function pullRedirects() {
  const Q = `
    query Rs($first: Int!, $after: String) {
      urlRedirects(first: $first, after: $after) {
        edges { node { id path target } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  try {
    const nodes = await paginate(async (after) => {
      const d = await gql(Q, { first: 50, after });
      return d.urlRedirects;
    });
    return nodes.map((n) => ({ id: n.id, path: n.path, target: n.target }));
  } catch (err) {
    // urlRedirects requires the read_online_store_navigation scope
    // (Shopify renamed this in 2024-10 — moved out of read_themes into
    // a dedicated scope per the GraphQL Admin API reference). Rather
    // than failing the entire pull when the scope is missing, return
    // null so main() preserves the existing redirects.json on disk —
    // the alternative is overwriting 1000+ entries with [] and silently
    // breaking every legacy redirect.
    if (/access\s*denied|ACCESS_DENIED/i.test(err?.message ?? '')) {
      console.warn(
        '\n[warning] urlRedirects access denied — token is missing the\n' +
        '          `read_online_store_navigation` scope. Skipping\n' +
        '          redirects pull; existing data/url-inventory/redirects.json\n' +
        '          is preserved. Add the scope in Shopify Admin → Develop\n' +
        '          apps → [app] → Configuration → API access scopes and\n' +
        '          reinstall to re-issue the token.\n',
      );
      return null;
    }
    throw err;
  }
}

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function redirectsToCsv(redirects) {
  // Shopify Admin URL Redirects import format: Redirect from,Redirect to
  const header = 'Redirect from,Redirect to';
  const rows = redirects.map((r) => `${csvEscape(r.path)},${csvEscape(r.target)}`);
  return [header, ...rows].join('\n') + '\n';
}

async function writeJson(name, data) {
  const file = resolve(OUT_DIR, `${name}.json`);
  await mkdir(OUT_DIR, { recursive: true });
  const payload = {
    $schema: `Shopify ${name} inventory snapshot`,
    $source: `Shopify Admin GraphQL (${STORE}) via scripts/pull-inventory.mjs`,
    $pulledAt: new Date().toISOString(),
    $count: Array.isArray(data) ? data.length : null,
    [name]: data,
  };
  await writeFile(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return file;
}

async function main() {
  const t0 = Date.now();
  console.log(`Pulling inventory from ${STORE}...`);

  const [collections, products, pages, blogs, redirects] = await Promise.all([
    pullCollections(),
    pullProducts(),
    pullPages(),
    pullBlogs(),
    pullRedirects(),
  ]);

  const colFile = await writeJson('collections', collections);
  const prdFile = await writeJson('products', products);
  const pgFile  = await writeJson('pages', pages);
  const blFile  = await writeJson('blogs', blogs);
  // redirects === null means pullRedirects() bailed out (missing
  // read_online_store_navigation scope). Preserve the existing
  // redirects.json + redirects.csv on disk in that case — overwriting
  // with [] would silently break every legacy redirect.
  const rdFile  = redirects === null ? null : await writeJson('redirects', redirects);

  if (redirects !== null) {
    const csv = redirectsToCsv(redirects);
    const csvFile = resolve(OUT_DIR, 'redirects.csv');
    await writeFile(csvFile, csv, 'utf8');
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nWrote in ${dt}s:`);
  console.log(`  ${colFile} — ${collections.length} collections`);
  console.log(`  ${prdFile} — ${products.length} active+published products`);
  console.log(`  ${pgFile} — ${pages.length} pages (filter on isPublished in app)`);
  console.log(`  ${blFile} — ${blogs.length} blogs (${blogs.reduce((a, b) => a + b.articles.length, 0)} articles)`);
  if (redirects !== null) {
    console.log(`  ${rdFile} — ${redirects.length} redirects`);
    console.log(`  ${resolve(OUT_DIR, 'redirects.csv')} — same redirects, Shopify Admin import format`);
  } else {
    console.log(`  data/url-inventory/redirects.json — preserved (read_online_store_navigation scope missing)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
