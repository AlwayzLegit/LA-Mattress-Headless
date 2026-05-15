#!/usr/bin/env node
/**
 * seo-backfill-product-seo.mjs — Backfill missing seo.title and
 * seo.description on Shopify products.
 *
 * Phase 277d / SEO improvement plan Phase 3. The 2026-05 audit found
 * ~35% of products (sample n=20) had no custom seo.title; the same
 * sample had 0% missing seo.description so this script focuses on
 * seo.title but also fills seo.description when missing as a safety net.
 *
 * Dry-run by default — preview the proposed changes against the live
 * catalog without mutating Shopify. Pass --apply to actually write.
 *
 * Title template:
 *   {Vendor} {Title} in Los Angeles · LA Mattress
 *   (capped to ~60 chars total; trims left-to-right when over)
 *
 * Description template (when missing):
 *   {Vendor} {Title} at LA Mattress Store in Los Angeles. Free
 *   white-glove delivery, 120-night comfort exchange, 0% APR financing.
 *
 * Output: a JSON report at data/seo-backfills/products-{timestamp}.json
 * with one entry per product showing the before/after state, even in
 * dry-run mode. The report is reviewable + greppable (and the merchant
 * can revert from it if a mutation goes wrong).
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-backfill-product-seo.mjs           # dry run
 *
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-backfill-product-seo.mjs --apply   # actually write
 *
 * Required Admin scopes: read_products, write_products.
 *
 * Idempotent: re-running won't double-write because the script only
 * touches products whose seo.title or seo.description is empty.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = '2024-10';
const APPLY = process.argv.includes('--apply');
const TITLE_MAX = 60;

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

async function pullProducts() {
  const Q = `
    query Ps($first: Int!, $after: String) {
      products(
        first: $first, after: $after, sortKey: ID,
        query: "status:active AND published_status:online_store_channel"
      ) {
        edges { node {
          id handle title vendor productType
          seo { title description }
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

// Phase 283: skip the vendor prefix when the title already contains the
// vendor name anywhere in it — common in this catalog, where titles read
// like "Diamond Diana Firm…" or "Twin XL Restonic Natural Latex…".
// Used by generateSeoDescription below to dedupe vendor mentions.
function titleContainsVendor(title, vendor) {
  return Boolean(vendor) && title.toLowerCase().includes(vendor.toLowerCase());
}

function generateSeoTitle({ title }) {
  // Phase 290 rewrite: when seo.title is empty, set it to the product
  // title directly (no truncation, no suffix).
  //
  // The earlier version of this function tried to bake a fixed
  // "in Los Angeles · LA Mattress" suffix and truncate the product
  // title from the right to fit a 60-char cap. That preserved the
  // suffix at the cost of the unique variant signature — the May 15
  // SEMrush re-audit flagged 39 products for "Duplicate title tag"
  // because sibling variants (Tempur-Pedic ProAdapt Soft / Medium /
  // Firm; Diamond Dreamstage Clarity Medium / Plush / Firm; etc.) all
  // truncated to the same prefix + suffix.
  //
  // Phase 281 had already switched the PDP template to absolute
  // titles, so the layout no longer appends a brand suffix — there's
  // no rendering reason to bake one into the seo.title. Phase 290
  // raised TITLE_MAX from 56 to 70 (lib/seo.ts), which lets nearly
  // every catalog title preserve its unique variant signature at
  // render time. So the cleanest thing to write into Shopify is just
  // the product title itself.
  //
  // The PDP template (app/products/[handle]/page.tsx generateMetadata)
  // will run capTitle on this and prefer the merchant's seo.title
  // when set — so this stays a fallback that respects merchant
  // overrides.
  return title;
}

function generateSeoDescription({ title, vendor }) {
  const vendorBit = vendor && !titleContainsVendor(title, vendor) ? `${vendor} ` : '';
  const naive = `${vendorBit}${title} at LA Mattress Store in Los Angeles. Free white-glove delivery, 120-night comfort exchange, 0% APR financing.`;
  return naive.length > 160 ? naive.slice(0, 157).trimEnd() + '...' : naive;
}

async function updateSeo({ id, seo }) {
  const M = `
    mutation U($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id }
        userErrors { field message }
      }
    }`;
  const d = await gql(M, { input: { id, seo } });
  const errs = d.productUpdate.userErrors;
  if (errs.length) throw new Error(`userErrors: ${JSON.stringify(errs)}`);
}

(async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will mutate Shopify)' : 'dry-run (preview only)'}`);
  const products = await pullProducts();
  console.log(`Pulled ${products.length} active+published products.`);

  const changes = [];
  for (const p of products) {
    const hasTitle = Boolean(p.seo?.title?.trim());
    const hasDesc = Boolean(p.seo?.description?.trim());
    if (hasTitle && hasDesc) continue;
    const next = {
      title: hasTitle ? p.seo.title : generateSeoTitle({ title: p.title, vendor: p.vendor }),
      description: hasDesc ? p.seo.description : generateSeoDescription({ title: p.title, vendor: p.vendor }),
    };
    changes.push({
      id: p.id,
      handle: p.handle,
      productTitle: p.title,
      vendor: p.vendor,
      before: { title: p.seo?.title ?? null, description: p.seo?.description ?? null },
      after: next,
      filledTitle: !hasTitle,
      filledDescription: !hasDesc,
    });
  }

  console.log(`Products needing backfill: ${changes.length}`);
  console.log(`  - missing seo.title:       ${changes.filter((c) => c.filledTitle).length}`);
  console.log(`  - missing seo.description: ${changes.filter((c) => c.filledDescription).length}`);

  await mkdir(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = resolve(OUT_DIR, `products-${ts}${APPLY ? '-applied' : '-dryrun'}.json`);
  await writeFile(
    reportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), mode: APPLY ? 'apply' : 'dry-run', changes }, null, 2),
  );
  console.log(`Wrote report: ${reportPath}`);

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to push the changes to Shopify.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const c of changes) {
    try {
      await updateSeo({ id: c.id, seo: c.after });
      ok += 1;
      if (ok % 25 === 0) console.log(`  applied ${ok}/${changes.length}…`);
    } catch (err) {
      fail += 1;
      console.error(`  FAILED ${c.handle}: ${err.message}`);
    }
  }
  console.log(`Done. ${ok} applied, ${fail} failed.`);
})();
