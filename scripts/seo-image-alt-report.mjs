#!/usr/bin/env node
/**
 * seo-image-alt-report.mjs — Find product images with no alt text and
 * pre-fill a suggested alt for each.
 *
 * Phase 277d / SEO improvement plan Phase 3. The codebase already
 * falls back to `productTitle` as the alt when `featuredImage.altText`
 * is null (see app/_components/plp-card.tsx and similar), but a
 * generic "Tempur-Pedic ProAdapt Soft 12 Inch Mattress" alt repeated
 * across every gallery + recently-viewed rail + search result is
 * weaker for image search than a specific, scannable alt.
 *
 * Read-only — produces a CSV with suggested alt text for merchant
 * review. The merchant copy/pastes approved alts into Shopify Admin
 * (Product → Edit images → Add alt text), and the next inventory
 * snapshot picks up the change.
 *
 * Suggested alt template:
 *   {Vendor} {Title} mattress photographed from the side, available in
 *   Los Angeles with free white-glove delivery
 *
 * Or for non-mattress products:
 *   {Vendor} {Title} at LA Mattress Store in Los Angeles
 *
 * Output: data/seo-backfills/image-alts-{timestamp}.csv
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-image-alt-report.mjs
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

async function pullProductImages() {
  const Q = `
    query Ps($first: Int!, $after: String) {
      products(
        first: $first, after: $after, sortKey: ID,
        query: "status:active AND published_status:online_store_channel"
      ) {
        edges { node {
          id handle title vendor productType
          featuredImage { url altText }
          images(first: 10) { edges { node { id url altText } } }
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

function suggestAlt({ title, vendor, productType }) {
  const isMattress = /mattress/i.test(productType || '') || /mattress/i.test(title);
  const vendorBit = vendor ? `${vendor} ` : '';
  if (isMattress) {
    return `${vendorBit}${title} photographed in our Los Angeles showroom, available with free white-glove delivery`;
  }
  return `${vendorBit}${title} at LA Mattress Store in Los Angeles`;
}

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

(async function main() {
  const products = await pullProductImages();
  console.log(`Pulled ${products.length} products.`);

  const rows = [['handle', 'title', 'image_id', 'image_url', 'current_alt', 'suggested_alt']];
  let missingCount = 0;
  for (const p of products) {
    const suggested = suggestAlt(p);
    for (const e of p.images.edges) {
      const img = e.node;
      const isMissing = !img.altText || !img.altText.trim();
      if (!isMissing) continue;
      missingCount += 1;
      rows.push([p.handle, p.title, img.id, img.url, '', suggested].map(csvEscape));
    }
  }

  console.log(`Images missing alt text: ${missingCount}`);
  await mkdir(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const csvPath = resolve(OUT_DIR, `image-alts-${ts}.csv`);
  await writeFile(csvPath, rows.map((r) => r.join(',')).join('\n') + '\n');
  console.log(`Wrote: ${csvPath}`);
  console.log('Review CSV, edit suggested_alt where wanted, then paste into Shopify Admin → Product → Edit images.');
})();
