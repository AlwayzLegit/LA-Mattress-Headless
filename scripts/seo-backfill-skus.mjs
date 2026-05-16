#!/usr/bin/env node
/**
 * seo-backfill-skus.mjs — Generate deterministic synthetic SKUs for
 * product variants that have an empty SKU.
 *
 * Phase 277d / SEO improvement plan Phase 3. The 2026-05 audit found
 * most product variants have no SKU set, which means the Product
 * JSON-LD on PDPs omits the `sku` field — weakening Google Product
 * results eligibility (Merchant Center prefers GTIN or MPN, but
 * accepts a stable SKU as a fallback identifier).
 *
 * Dry-run by default. Pass --apply to write.
 *
 * SKU template:
 *   {handle-upper-snake}-{variant-key}
 *   where variant-key is the variant's title with spaces collapsed,
 *   forward-slashes replaced with dashes, lowercased.
 *
 * Example:
 *   handle "standard-foundation-box-spring", variant "King / Black"
 *   → "STANDARD-FOUNDATION-BOX-SPRING-KING-BLACK"
 *
 * The SKU is deterministic per (handle, variant title) pair, so
 * re-running is idempotent: each variant gets exactly the same SKU
 * each time. Variants whose SKU is already non-empty are skipped
 * (merchant-set SKUs are never overwritten).
 *
 * Caveats:
 *   - Synthetic SKUs are NOT a substitute for real manufacturer SKUs
 *     (UPC, GTIN, MPN). When the merchant has real SKUs, they should
 *     supersede these. This script just unblocks JSON-LD emission
 *     until real SKUs are entered.
 *   - The Admin API limits productVariantsBulkUpdate to 250 variants
 *     per call; we batch accordingly.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-backfill-skus.mjs            # dry run
 *
 * Required Admin scopes: read_products, write_products.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = '2024-10';
const APPLY = process.argv.includes('--apply');
const BATCH = 250;
// Phase 285: Google Merchant Center recommends SKU/id ≤50 chars; Shopify
// allows up to 255 but anything over ~50 is unwieldy across downstream
// systems (POS, ERP, vendor feeds). When the templated SKU exceeds this,
// we keep the readable prefix and append a deterministic 8-char SHA-256
// suffix so it stays unique across re-runs without growing without bound.
const SKU_MAX = 50;

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

async function pullProductsWithVariants() {
  const Q = `
    query Ps($first: Int!, $after: String) {
      products(
        first: $first, after: $after, sortKey: ID,
        query: "status:active AND published_status:online_store_channel"
      ) {
        edges { node {
          id handle title
          variants(first: 100) { edges { node { id title sku } } }
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  const all = [];
  let after;
  let safety = 200;
  while (safety-- > 0) {
    const d = await gql(Q, { first: 25, after });
    all.push(...d.products.edges.map((e) => e.node));
    if (!d.products.pageInfo.hasNextPage) break;
    after = d.products.pageInfo.endCursor;
  }
  return all;
}

// Phase 285: cap to SKU_MAX (industry standard ≤50 chars). When the
// templated SKU exceeds it, keep the readable prefix and append a
// deterministic 8-char SHA-256 suffix so the SKU stays unique and stable
// across re-runs (re-running buildSku on the same input always produces
// the same output, so the script remains idempotent).
function shorten(sku) {
  if (sku.length <= SKU_MAX) return sku;
  const hash = crypto.createHash('sha256').update(sku).digest('hex').slice(0, 8).toUpperCase();
  const prefix = sku.slice(0, SKU_MAX - 9).replace(/-+$/, '');
  return `${prefix}-${hash}`;
}

function buildSku({ handle, variantTitle }) {
  const handleUp = handle.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const variantSlug = variantTitle
    .toUpperCase()
    .replace(/[\\/]+/g, '-')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Single-variant product (Shopify default) → just the handle.
  if (!variantSlug || variantSlug === 'DEFAULT-TITLE') return shorten(handleUp);
  // Variant title duplicates the handle (e.g. a single named variant where
  // the merchant repeated the product title) → don't double it up.
  if (variantSlug === handleUp) return shorten(handleUp);
  return shorten(`${handleUp}-${variantSlug}`);
}

async function applyBatch(productId, updates) {
  // productVariantsBulkUpdate takes one productId + an array of variant
  // ids + new fields. Each call is limited to ~250 variants by Admin
  // API limits, so per-product calls are fine (largest product here
  // has ~8 variants).
  const M = `
    mutation V($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id sku }
        userErrors { field message }
      }
    }`;
  const d = await gql(M, { productId, variants: updates });
  const errs = d.productVariantsBulkUpdate.userErrors;
  if (errs.length) throw new Error(`userErrors: ${JSON.stringify(errs)}`);
}

(async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will mutate Shopify)' : 'dry-run (preview only)'}`);
  const products = await pullProductsWithVariants();
  console.log(`Pulled ${products.length} products.`);

  const updates = [];
  for (const p of products) {
    // Phase 285: dedupe variant edges by id. Shopify occasionally returns
    // the same variant under multiple option-combination edges (the Helix
    // Twilight Elite has 12 edges for 11 unique variants), and
    // productVariantsBulkUpdate rejects the whole batch with "Duplicated
    // input value" if any id appears twice. Keeping the first occurrence
    // yields a stable, deterministic SKU per variant.
    const seenVariantIds = new Set();
    const productUpdates = [];
    for (const e of p.variants.edges) {
      const v = e.node;
      if (seenVariantIds.has(v.id)) continue;
      seenVariantIds.add(v.id);
      if (v.sku && v.sku.trim()) continue;
      const sku = buildSku({ handle: p.handle, variantTitle: v.title });
      productUpdates.push({ variantId: v.id, variantTitle: v.title, newSku: sku });
    }
    if (productUpdates.length === 0) continue;
    updates.push({
      productId: p.id,
      handle: p.handle,
      title: p.title,
      variants: productUpdates,
    });
  }

  const variantCount = updates.reduce((n, u) => n + u.variants.length, 0);
  console.log(`Products with variants needing SKU: ${updates.length}`);
  console.log(`Total variants to update:           ${variantCount}`);

  await mkdir(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = resolve(OUT_DIR, `skus-${ts}${APPLY ? '-applied' : '-dryrun'}.json`);
  await writeFile(
    reportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), mode: APPLY ? 'apply' : 'dry-run', updates }, null, 2),
  );
  console.log(`Wrote report: ${reportPath}`);

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to push the changes to Shopify.');
    return;
  }

  let okProducts = 0;
  let failProducts = 0;
  for (const u of updates) {
    try {
      // Batch within product just in case a product has >BATCH variants.
      for (let i = 0; i < u.variants.length; i += BATCH) {
        const slice = u.variants.slice(i, i + BATCH);
        await applyBatch(
          u.productId,
          slice.map((v) => ({ id: v.variantId, inventoryItem: { sku: v.newSku } })),
        );
      }
      okProducts += 1;
      if (okProducts % 25 === 0) console.log(`  applied to ${okProducts}/${updates.length} products…`);
    } catch (err) {
      failProducts += 1;
      console.error(`  FAILED ${u.handle}: ${err.message}`);
    }
  }
  console.log(`Done. ${okProducts} products updated, ${failProducts} failed.`);
})();
