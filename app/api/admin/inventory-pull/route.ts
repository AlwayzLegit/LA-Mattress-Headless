/**
 * TEMPORARY: server-side inventory pull endpoint.
 *
 * Runs the same Shopify Admin GraphQL queries as
 * `scripts/pull-inventory.mjs` but executes inside the deployed app
 * (which has SHOPIFY_ADMIN_TOKEN in env). Returns all 5 datasets in
 * one JSON response. Saves us from running the script locally OR
 * burning thousands of tokens fetching the data through the MCP
 * one page at a time.
 *
 * Caller saves each top-level key to data/url-inventory/*.json,
 * commits, pushes — sitemap then picks up the refreshed inventory
 * on the next build.
 *
 * Token-gated query param so a random visitor can't trigger 2k+
 * Shopify Admin GraphQL calls. DELETE this file after the refresh.
 *
 * Usage:
 *   curl 'https://<deployment>/api/admin/inventory-pull?token=inv-pull-2026-05-23'
 */

import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Default Vercel function timeout is 10s for Hobby, 60s for Pro/Team.
// Inventory pull does ~30 paginated queries; bump to the max so the
// blog + redirects pull doesn't time out under serial pagination.
export const maxDuration = 300;

const STORE = process.env.SHOPIFY_STORE_DOMAIN
  ?? process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
  ?? process.env.SHOPIFY_DOMAIN
  ?? process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
  ?? process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  ?? process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = '2024-10';
const SECRET = 'inv-pull-2026-05-23';

async function gql(query: string, variables: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await fetch(`https://${STORE}/admin/api/${VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN ?? '',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type Connection<T> = { edges: { node: T }[]; pageInfo: PageInfo };

async function paginate<T>(
  fn: (after: string | null) => Promise<Connection<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | null = null;
  let safety = 200;
  while (safety-- > 0) {
    const { edges, pageInfo }: Connection<T> = await fn(after);
    all.push(...edges.map((e) => e.node));
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }
  return all;
}

async function pullCollections() {
  const Q = `query Cs($first: Int!, $after: String) {
    collections(first: $first, after: $after, sortKey: ID) {
      edges { node { id handle title updatedAt productsCount { count } seo { title description } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const nodes = await paginate<{
    id: string; handle: string; title: string; updatedAt: string;
    productsCount?: { count: number } | null; seo?: { title?: string | null; description?: string | null } | null;
  }>(async (after) => {
    const d = await gql(Q, { first: 50, after });
    return d.collections as Connection<never>;
  });
  return nodes.map((n) => ({
    handle: n.handle, id: n.id, title: n.title,
    productsCount: n.productsCount?.count ?? null,
    updatedAt: n.updatedAt,
    seoTitle: n.seo?.title ?? null,
    seoDescription: n.seo?.description ?? null,
  }));
}

async function pullProducts() {
  const Q = `query Ps($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: ID,
             query: "status:active AND published_status:online_store_channel") {
      edges { node { id handle title vendor productType publishedAt updatedAt
        seo { title description } featuredImage { url } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const nodes = await paginate<{
    id: string; handle: string; title: string; vendor?: string | null; productType?: string | null;
    publishedAt: string; updatedAt: string;
    seo?: { title?: string | null; description?: string | null } | null;
    featuredImage?: { url?: string | null } | null;
  }>(async (after) => {
    const d = await gql(Q, { first: 50, after });
    return d.products as Connection<never>;
  });
  return nodes.map((n) => ({
    handle: n.handle, id: n.id, title: n.title, vendor: n.vendor, productType: n.productType,
    publishedAt: n.publishedAt, updatedAt: n.updatedAt,
    seoTitle: n.seo?.title ?? null, seoDescription: n.seo?.description ?? null,
    featuredImage: n.featuredImage?.url ?? null,
  }));
}

async function pullPages() {
  const Q = `query Pgs($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      edges { node { id handle title isPublished publishedAt updatedAt } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  return paginate<{ id: string; handle: string; title: string; isPublished: boolean; publishedAt: string | null; updatedAt: string }>(async (after) => {
    const d = await gql(Q, { first: 50, after });
    return d.pages as Connection<never>;
  });
}

async function pullBlogs() {
  const QB = `query Bs($first: Int!, $after: String) {
    blogs(first: $first, after: $after) {
      edges { node { id handle title updatedAt } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const blogs = await paginate<{ id: string; handle: string; title: string; updatedAt: string }>(async (after) => {
    const d = await gql(QB, { first: 50, after });
    return d.blogs as Connection<never>;
  });
  const QA = `query As($id: ID!, $first: Int!, $after: String) {
    blog(id: $id) {
      articles(first: $first, after: $after) {
        edges { node { id handle title isPublished publishedAt updatedAt } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;
  const out: Array<{ id: string; handle: string; title: string; updatedAt: string; articles: unknown[] }> = [];
  for (const b of blogs) {
    const articles: unknown[] = [];
    let after: string | null = null;
    let safety = 200;
    while (safety-- > 0) {
      const d = await gql(QA, { id: b.id, first: 50, after });
      const conn = (d.blog as { articles?: Connection<unknown> } | null)?.articles;
      if (!conn) break;
      articles.push(...conn.edges.map((e) => e.node));
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    out.push({ handle: b.handle, id: b.id, title: b.title, updatedAt: b.updatedAt, articles });
  }
  return out;
}

async function pullRedirects(): Promise<{ id: string; path: string; target: string }[] | null> {
  const Q = `query Rs($first: Int!, $after: String) {
    urlRedirects(first: $first, after: $after) {
      edges { node { id path target } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  try {
    return await paginate<{ id: string; path: string; target: string }>(async (after) => {
      const d = await gql(Q, { first: 50, after });
      return d.urlRedirects as Connection<never>;
    });
  } catch (err) {
    if (/access\s*denied|ACCESS_DENIED/i.test(String(err))) return null;
    throw err;
  }
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('token') !== SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!STORE || !TOKEN) {
    // Report exactly which env var names exist so we can identify the
    // actual var names the merchant has set in Vercel.
    const shopifyKeysSet = Object.keys(process.env).filter((k) => /SHOPIFY/i.test(k));
    return NextResponse.json({
      error: 'missing env: SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN',
      shopifyKeysSet,
      storeResolved: STORE ?? null,
      tokenResolved: TOKEN ? `${TOKEN.slice(0, 6)}…(${TOKEN.length}c)` : null,
    }, { status: 500 });
  }
  const t0 = Date.now();
  try {
    // Pull in parallel — Shopify Admin handles concurrency well, and the
    // 60-300s function ceiling means serial pagination would risk timing
    // out on the blog + articles step.
    const [collections, products, pages, blogs, redirects] = await Promise.all([
      pullCollections(),
      pullProducts(),
      pullPages(),
      pullBlogs(),
      pullRedirects(),
    ]);
    return NextResponse.json({
      ok: true,
      elapsedMs: Date.now() - t0,
      pulledAt: new Date().toISOString(),
      counts: {
        collections: collections.length,
        products: products.length,
        pages: pages.length,
        blogs: blogs.length,
        articles: blogs.reduce((a, b) => a + b.articles.length, 0),
        redirects: redirects?.length ?? null,
      },
      data: { collections, products, pages, blogs, redirects },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
