#!/usr/bin/env node
/**
 * seo-tag-cleanup-report.mjs — Audit product tag bloat and produce a
 * merchant-review CSV.
 *
 * Phase 277d / SEO improvement plan Phase 3. The 2026-05 audit and the
 * Shopify product sample both showed products carrying 50+ tags, many
 * of which overlap (e.g. "King Memory Foam Mattresses" +
 * "Memory Foam Queen Mattresses" + "Tempur-Pedic Queen Hybrid
 * Mattresses" all on a king-sized memory-foam product). These bloated
 * tag sets drive duplicate-content collection pages because Shopify
 * smart collections each generate a URL.
 *
 * This script DOES NOT MUTATE — it produces a CSV the merchant can
 * scan, with one row per product, listing the tag count and groups of
 * near-duplicate tags it found. The merchant decides which to remove
 * in Shopify Admin; the next inventory snapshot picks up the cleaned
 * state.
 *
 * Heuristic for "near-duplicate": pairs of tags where one is a substring
 * of the other (case-insensitive), OR pairs sharing >=2 tokens after
 * splitting on whitespace. Tuned to find groups like:
 *   - "Memory Foam Mattresses" + "Memory Foam Queen Mattresses" + "Memory Foam"
 *   - "King Innerspring Mattresses" + "King Hybrid Mattresses" (kept separate — different concept)
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-tag-cleanup-report.mjs
 *
 * Output: data/seo-backfills/tag-cleanup-{timestamp}.csv
 *
 * Required Admin scopes: read_products.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = '2024-10';
const TAG_THRESHOLD = 20;

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN');
  process.exit(1);
}

const ENDPOINT = `https://${STORE}/admin/api/${VERSION}/graphql.json`;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seo-backfills');

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function pullProductTags() {
  const Q = `
    query Ps($first: Int!, $after: String) {
      products(
        first: $first, after: $after, sortKey: ID,
        query: "status:active AND published_status:online_store_channel"
      ) {
        edges { node { id handle title tags } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  const all = [];
  let after;
  let safety = 200;
  while (safety-- > 0) {
    const d = await gql(Q, { first: 50, after });
    all.push(...d.products.edges.map((e) => e.node));
    if (!d.products.pageInfo.hasNextPage) break;
    after = d.products.pageInfo.endCursor;
  }
  return all;
}

function tokens(s) {
  return new Set(s.toLowerCase().split(/\s+/).filter(Boolean));
}

function findNearDuplicateGroups(tags) {
  // Returns an array of groups (each is array of tags that share ≥2 tokens
  // or substring containment). Each tag appears in at most one group.
  const groups = [];
  const seen = new Set();
  for (let i = 0; i < tags.length; i += 1) {
    if (seen.has(tags[i])) continue;
    const group = [tags[i]];
    const ti = tokens(tags[i]);
    for (let j = i + 1; j < tags.length; j += 1) {
      if (seen.has(tags[j])) continue;
      const tj = tokens(tags[j]);
      const a = tags[i].toLowerCase();
      const b = tags[j].toLowerCase();
      const sharedTokens = [...ti].filter((t) => tj.has(t)).length;
      const substring = a.includes(b) || b.includes(a);
      if (substring || sharedTokens >= 2) {
        group.push(tags[j]);
        seen.add(tags[j]);
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

(async function main() {
  const products = await pullProductTags();
  console.log(`Pulled ${products.length} active+published products.`);

  const rows = [['handle', 'title', 'tag_count', 'flagged', 'near_duplicate_groups', 'all_tags']];

  let flaggedCount = 0;
  for (const p of products) {
    const tagCount = p.tags.length;
    const groups = findNearDuplicateGroups(p.tags);
    const flagged = tagCount >= TAG_THRESHOLD || groups.length > 0;
    if (flagged) flaggedCount += 1;
    rows.push([
      p.handle,
      p.title,
      tagCount,
      flagged ? 'yes' : 'no',
      groups.map((g) => g.join(' | ')).join('  ;;  '),
      p.tags.join(', '),
    ].map(csvEscape));
  }

  console.log(`Flagged products: ${flaggedCount}/${products.length}`);

  await mkdir(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const csvPath = resolve(OUT_DIR, `tag-cleanup-${ts}.csv`);
  await writeFile(csvPath, rows.map((r) => r.join(',')).join('\n') + '\n');
  console.log(`Wrote: ${csvPath}`);
  console.log('Review the CSV; remove obvious duplicates in Shopify Admin (Bulk editor → Tags column).');
})();
