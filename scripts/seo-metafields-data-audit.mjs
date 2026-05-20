#!/usr/bin/env node
/**
 * seo-metafields-data-audit.mjs — Read-only audit of any data present on
 * the orphan COLLECTION metafield definitions that the audit at
 * docs/design/shopify-metafields-metaobjects-audit.md proposes deleting,
 * plus the singular `custom.sleep_position` PRODUCT metafield.
 *
 * Stress-test B2 / Audit Phase 2.5 — produces the evidence trail the
 * merchant signs off against before any metafieldDefinitionDelete runs.
 *
 * Targets:
 *   COLLECTION custom.*:  description_, link, link1, link2, link3, link4, link5,
 *                         label, label1, label2, label3, label4, label5, seo_content
 *   PRODUCT   custom.*:   sleep_position    (singular — duplicate of plural sleep_positions)
 *
 * Read-only. Does NOT mutate Shopify. Always safe to run.
 *
 * Output: data/seo-metafields/data-audit-{timestamp}.csv
 *   Columns: owner_type, owner_handle, owner_title, namespace, key,
 *            has_value, value_len, value_preview
 *   Rows: one per (owner, key) where the field has a non-empty value.
 *         Empty fields are omitted from the CSV but counted in the summary.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-metafields-data-audit.mjs
 *
 * Required Admin scopes: read_products.
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
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seo-metafields');

// Keys we're auditing on COLLECTION owners.
const COLLECTION_KEYS = [
  'description_',
  'link', 'link1', 'link2', 'link3', 'link4', 'link5',
  'label', 'label1', 'label2', 'label3', 'label4', 'label5',
  'seo_content',
];

// Keys we're auditing on PRODUCT owners (only one — the singular duplicate).
const PRODUCT_KEYS = ['sleep_position'];

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

async function pullCollections() {
  // Identifiers query for COLLECTION metafields — we ask for the 14 keys
  // explicitly so we get one node per key per collection (null if absent),
  // and don't pay for fields we don't care about.
  const identifiers = COLLECTION_KEYS.map((k) => `{ namespace: "custom", key: "${k}" }`).join(', ');
  const Q = `
    query Cs($first: Int!, $after: String) {
      collections(first: $first, after: $after, sortKey: ID) {
        edges { node {
          id handle title
          metafields(identifiers: [${identifiers}]) { namespace key value type }
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  const all = [];
  let after;
  let safety = 50;
  while (safety-- > 0) {
    const d = await gql(Q, { first: 50, after });
    all.push(...d.collections.edges.map((e) => e.node));
    if (!d.collections.pageInfo.hasNextPage) break;
    after = d.collections.pageInfo.endCursor;
  }
  return all;
}

async function pullProducts() {
  // For PRODUCT.sleep_position: pull only products that have any value
  // set. We page through all active products (status:active is the
  // broadest realistic surface) and inspect the metafield.
  const identifiers = PRODUCT_KEYS.map((k) => `{ namespace: "custom", key: "${k}" }`).join(', ');
  const Q = `
    query Ps($first: Int!, $after: String) {
      products(first: $first, after: $after, sortKey: ID, query: "status:active") {
        edges { node {
          id handle title
          metafields(identifiers: [${identifiers}]) { namespace key value type }
        } }
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

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function previewValue(raw) {
  // For rich-text JSON, strip the JSON wrapper for the preview; for
  // plain strings just take the first 120 chars.
  if (!raw) return '';
  let s = raw;
  // Rich-text fields arrive as JSON like {"type":"root","children":[...]}.
  // For the preview we just collapse whitespace and chop.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      // Try to extract text content.
      const walk = (n) => {
        if (!n) return '';
        if (typeof n === 'string') return n;
        if (Array.isArray(n)) return n.map(walk).join(' ');
        if (typeof n === 'object') {
          if (typeof n.value === 'string') return n.value;
          if (Array.isArray(n.children)) return walk(n.children);
        }
        return '';
      };
      s = walk(parsed).trim();
    }
  } catch {
    // Not JSON — fine, use the raw value.
  }
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 120 ? s.slice(0, 117) + '...' : s;
}

function valueLength(raw) {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const walk = (n) => {
        if (!n) return '';
        if (typeof n === 'string') return n;
        if (Array.isArray(n)) return n.map(walk).join('');
        if (typeof n === 'object') {
          if (typeof n.value === 'string') return n.value;
          if (Array.isArray(n.children)) return walk(n.children);
        }
        return '';
      };
      return walk(parsed).length;
    }
  } catch {
    // Not JSON.
  }
  return raw.length;
}

(async function main() {
  try {
    console.log(`Read-only audit. Store: ${STORE}, API: ${VERSION}`);
    console.log('Pulling collections…');
    const collections = await pullCollections();
    console.log(`  ${collections.length} collections.`);
    console.log('Pulling products…');
    const products = await pullProducts();
    console.log(`  ${products.length} active products.`);

    const rows = [];
    // Tally: { 'collection:link1': { populated: N, empty: M }, ... }
    const tally = {};
    const tallyBump = (ownerType, key, populated) => {
      const k = `${ownerType}:${key}`;
      tally[k] ??= { populated: 0, empty: 0 };
      tally[k][populated ? 'populated' : 'empty'] += 1;
    };

    for (const c of collections) {
      const byKey = new Map((c.metafields ?? []).filter(Boolean).map((m) => [m.key, m]));
      for (const key of COLLECTION_KEYS) {
        const mf = byKey.get(key);
        const val = mf?.value ?? '';
        const hasValue = val.trim().length > 0;
        tallyBump('collection', key, hasValue);
        if (hasValue) {
          rows.push({
            owner_type: 'collection',
            owner_handle: c.handle,
            owner_title: c.title,
            namespace: 'custom',
            key,
            has_value: true,
            value_len: valueLength(val),
            value_preview: previewValue(val),
          });
        }
      }
    }

    for (const p of products) {
      const byKey = new Map((p.metafields ?? []).filter(Boolean).map((m) => [m.key, m]));
      for (const key of PRODUCT_KEYS) {
        const mf = byKey.get(key);
        const val = mf?.value ?? '';
        const hasValue = val.trim().length > 0;
        tallyBump('product', key, hasValue);
        if (hasValue) {
          rows.push({
            owner_type: 'product',
            owner_handle: p.handle,
            owner_title: p.title,
            namespace: 'custom',
            key,
            has_value: true,
            value_len: valueLength(val),
            value_preview: previewValue(val),
          });
        }
      }
    }

    // CSV output
    await mkdir(OUT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const csvPath = resolve(OUT_DIR, `data-audit-${ts}.csv`);
    const header = 'owner_type,owner_handle,owner_title,namespace,key,has_value,value_len,value_preview\n';
    const body = rows
      .map((r) =>
        [r.owner_type, r.owner_handle, r.owner_title, r.namespace, r.key, r.has_value, r.value_len, r.value_preview]
          .map(csvEscape)
          .join(','),
      )
      .join('\n');
    await writeFile(csvPath, header + body + (body ? '\n' : ''));
    console.log(`\nWrote CSV: ${csvPath}`);
    console.log(`  ${rows.length} (owner, key) pairs with populated data.\n`);

    // Summary tally
    console.log('Per-key populated / empty counts:');
    const ownerTotals = { collection: collections.length, product: products.length };
    const keys = [
      ...COLLECTION_KEYS.map((k) => ['collection', k]),
      ...PRODUCT_KEYS.map((k) => ['product', k]),
    ];
    for (const [ownerType, key] of keys) {
      const t = tally[`${ownerType}:${key}`] ?? { populated: 0, empty: 0 };
      const flag = t.populated > 0 ? '  ⚠  has data — merchant review required' : '  ✓  empty everywhere — safe to delete';
      console.log(
        `  ${ownerType.padEnd(11)} custom.${key.padEnd(14)}  populated ${String(t.populated).padStart(3)} / ${String(ownerTotals[ownerType]).padStart(3)}${flag}`,
      );
    }

    console.log('\nNext steps:');
    console.log('  1. Open the CSV in a spreadsheet.');
    console.log('  2. For every row, decide: safe to delete OR keep.');
    console.log('  3. Per-field decision feeds Phase 3 of the metafields audit doc.');
    console.log('  4. Fields with zero populated rows above are safe to delete unconditionally.');
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
})();
