#!/usr/bin/env node
/**
 * seo-pdp-boilerplate-strip.mjs — Remove the three shared boilerplate
 * blocks from the 36 enriched Diamond/Helix PDP descriptions so their
 * main content is dominantly unique (SEMrush 2026-07-14, issue 223
 * errorType 2 — duplicate content).
 *
 * A prior enrichment baked three identical-within-brand blocks into
 * every product's descriptionHtml:
 *   1. the brand-story paragraph ("Diamond Mattress is a 4th-generation
 *      family-owned company…" / "Helix Sleep was founded in New York
 *      City…") — identical across all 30 Diamond / 6 Helix PDPs;
 *   2. the "Why Shop at LA Mattress Store" <h3>+<p> block;
 *   3. the closing "Have questions? Call us…" CTA <p>.
 * The Round 10 diversify made the middle two sections (Technology &
 * Construction, Who This Is Best For) unique, but these three remained
 * word-for-word shared — leaving the pages >60% duplicate.
 *
 * Blocks 2 and 3 are fully redundant with the PDP FAQ (buildProductFaq
 * already renders delivery, 120-night exchange, warranty, financing and
 * showrooms as FAQ JSON-LD), so they are dropped outright. Block 1 (the
 * brand story) is preserved but moved to the PDP template's brand band
 * (app/(storefront)/products/[handle]/pdp-brand-story.tsx), which renders
 * it once per PDP; the component self-gates on the same brand signature,
 * so it only appears after this script removes the in-body copy.
 *
 * After stripping, each description is: <h2> title + Technology &
 * Construction + Who This Is Best For + Available Sizes — all unique.
 *
 * Same safety pattern as seo-pdp-content-diversify.mjs: dry-run by
 * default; --apply writes via productUpdate with a SHA-verified read-back
 * and rollback on mismatch; a product missing any of the three blocks is
 * SKIPPED (never partially edited); JSON report to data/seo-backfills/.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=… SHOPIFY_ADMIN_TOKEN=… \
 *     node scripts/seo-pdp-boilerplate-strip.mjs            # dry-run
 *     node scripts/seo-pdp-boilerplate-strip.mjs --apply    # write all
 *     node scripts/seo-pdp-boilerplate-strip.mjs <handle>   # one product
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = '2024-10';
const APPLY = process.argv.includes('--apply');

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN');
  process.exit(1);
}

// The 36 enriched handles (30 Diamond + 6 Helix) — the same set the
// diversify script targets. Detection below still guards every write, so
// a handle here that lacks the blocks is skipped rather than mangled.
const HANDLES = [
  'topaz-diamond-mattress',
  'rock-extra-firm-mattress-diamond-mattress',
  'progel-8-memory-diamond-mattress',
  'plush-lucille-luxury-natural-latex-diamond-mattress',
  'medium-lucille-luxury-natural-latex-diamond-mattress',
  'firm-lucille-natural-latex-generation-diamond-mattress',
  'firm-diana-luxury-natural-latex-euro-top-diamond-mattress',
  'diana-natural-latex-luxury-medium-euro-top-by-diamond-mattress',
  'diana-natural-latex-luxury-plush-euro-top-diamond-mattress',
  'diamond-technogel-melodia-medium-firm',
  'diamond-technogel-technology-armonia-foam-mattress-11',
  'diamond-glory-plush-cool-gel-swirl-memory-foam-12-mattress',
  'diamond-glory-medium-cool-gel-swirl-memory-foam-12-mattress',
  'diamond-dreamstage-collection-2-0-grace-firm-gel-swirl-memory-foam-12-mattress',
  'diamond-dreamstage-2-0-medium-gel-swirl-memory-foam-12-mattress',
  'diamond-dreamstage-2-0-grace-plush-gel-swirl-memory-foam-12-mattress',
  'diamond-dreamstage-2-0-collection-tranquility-plush-titanium-memory-foam-euro-top-16-mattress',
  'diamond-dreamstage-2-0-collection-tranquility-firm-gel-memory-foam-tight-top-16-mattress',
  'diamond-dreamstage-2-0-collection-medium-titanium-memory-foam-euro-top-16-mattress',
  'diamond-dreamstage-2-0-collection-glory-firm-cool-gel-swirl-memory-foam-12-mattress',
  'diamond-dreamstage-2-0-collection-clarity-plush-hybrid-cool-copper-gel-memory-foam-14-mattress-copy',
  'diamond-dreamstage-2-0-collection-clarity-plush-cool-copper-gel-memory-foam-13-mattress',
  'diamond-dreamstage-2-0-collection-clarity-medium-hybrid-cool-copper-gel-memory-foam-12-mattress-copy',
  'diamond-dreamstage-2-0-collection-clarity-medium-cool-copper-gel-memory-foam-13-mattress',
  'diamond-dreamstage-2-0-collection-clarity-firm-hybrid-cool-copper-gel-memory-foam-14-mattress',
  'diamond-dreamstage-2-0-collection-clarity-firm-cool-copper-gel-memory-foam-13-mattress',
  'diamond-black-diamond-collection-snowbird-plush-hybrid-titanium-memory-foam-15-mattress',
  'diamond-black-diamond-collection-snowbird-medium-hybrid-15-mattress',
  'diamond-black-diamond-collection-snowbird-firm-hybrid-cool-gel-memory-foam-mattress',
  '10-gel-memory-diamond-mattress',
  'helix-sunset-15-soft-hybrid-elite-mattress',
  'helix-sleep-elite-collection-midnight-elite-luxury-plush-15-mattress',
  'helix-luxe-collection-twilight-elite-mattress',
  'helix-moonlight-15-medium-soft-hybrid-elite-mattress',
  'helix-plus-elite-15-firm-hybrid-mattress-for-plus-size-sleepers',
  'helix-plus-11-5-firm-hybrid-mattress-for-plus-size-sleepers',
];

// Brand-story signatures — MUST stay in sync with lib/brand-story.ts.
const BRAND_SIGNATURES = [
  'Diamond Mattress is a 4th-generation family-owned company',
  'Helix Sleep was founded in New York City',
];

const ENDPOINT = `https://${STORE}/admin/api/${VERSION}/graphql.json`;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seo-backfills');
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const normalize = (s) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

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

async function fetchProduct(handle) {
  const d = await gql(
    `query F($q: String!) { products(first: 1, query: $q) { nodes { id handle title descriptionHtml } } }`,
    { q: `handle:${handle}` },
  );
  return d.products.nodes[0] || null;
}

async function updateDescription(id, descriptionHtml) {
  const d = await gql(
    `mutation U($input: ProductInput!) { productUpdate(input: $input) { product { id } userErrors { field message } } }`,
    { input: { id, descriptionHtml } },
  );
  const errs = d.productUpdate.userErrors;
  if (errs.length) throw new Error(`userErrors: ${JSON.stringify(errs)}`);
}

const BRAND_STORY_RE = new RegExp(
  `<p[^>]*>\\s*(?:${BRAND_SIGNATURES.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[\\s\\S]*?<\\/p>\\s*`,
);
const WHY_SHOP_RE = /<h3[^>]*>\s*Why Shop at LA Mattress Store\s*<\/h3>\s*<p[^>]*>[\s\S]*?<\/p>\s*/;
const CTA_RE = /<p[^>]*>\s*Have questions\?[\s\S]*?<\/p>\s*/;

/**
 * Strip the three shared boilerplate blocks. Returns null when the
 * description is not the enriched format (any block missing) so the
 * product is skipped rather than partially edited. Post-strip we assert
 * the unique blocks survive and the boilerplate is gone.
 */
function strip(html) {
  if (!BRAND_STORY_RE.test(html) || !WHY_SHOP_RE.test(html) || !CTA_RE.test(html)) return null;
  let out = html.replace(BRAND_STORY_RE, '').replace(WHY_SHOP_RE, '').replace(CTA_RE, '');
  // The unique sections must remain (never strip a page down to nothing).
  if (!/Technology (?:&amp;|&) Construction/.test(out) || !/Available Sizes/.test(out)) return null;
  // And no boilerplate may survive.
  if (BRAND_SIGNATURES.some((s) => out.includes(s)) || /Why Shop at LA Mattress Store/.test(out) || /Have questions\?/.test(out)) {
    return null;
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// ===== main =====
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const handles = positional.length ? positional : HANDLES;
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 20);
const mode = APPLY ? 'apply' : 'dryrun';
const report = { ts, mode, handles: handles.length, results: [] };

for (const handle of handles) {
  try {
    const product = await fetchProduct(handle);
    if (!product) {
      console.error(`SKIP ${handle}: product not found`);
      report.results.push({ handle, status: 'not-found' });
      continue;
    }
    const next = strip(product.descriptionHtml ?? '');
    if (next === null) {
      console.error(`SKIP ${handle}: not the enriched boilerplate format`);
      report.results.push({ handle, status: 'not-enriched' });
      continue;
    }
    if (normalize(next) === normalize(product.descriptionHtml)) {
      console.log(`OK   ${handle}: already stripped (no-op)`);
      report.results.push({ handle, status: 'noop' });
      continue;
    }
    if (!APPLY) {
      console.log(`DRY  ${handle}: would strip (${product.descriptionHtml.length} -> ${next.length} chars)`);
      report.results.push({ handle, status: 'would-strip', before: product.descriptionHtml.length, after: next.length });
      continue;
    }
    const expected = sha256(normalize(next));
    await updateDescription(product.id, next);
    const check = await fetchProduct(handle);
    const got = sha256(normalize(check.descriptionHtml ?? ''));
    if (got !== expected) {
      console.error(`ROLLBACK ${handle}: verify mismatch — restoring original`);
      await updateDescription(product.id, product.descriptionHtml);
      report.results.push({ handle, status: 'rolled-back' });
      process.exitCode = 1;
      continue;
    }
    console.log(`APPLIED ${handle} (${product.descriptionHtml.length} -> ${next.length} chars)`);
    report.results.push({ handle, status: 'applied', before: product.descriptionHtml.length, after: next.length });
  } catch (err) {
    console.error(`ERROR ${handle}: ${err.message}`);
    report.results.push({ handle, status: 'error', error: err.message });
    process.exitCode = 1;
  }
}

await mkdir(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, `pdp-boilerplate-strip-${ts}-${mode}.json`);
await writeFile(outPath, JSON.stringify(report, null, 2));
console.log(`\nReport written: ${outPath}`);
