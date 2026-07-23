#!/usr/bin/env node
/**
 * seo-emdash-cleanup.mjs — Remove em dashes (—, U+2014) from Shopify
 * content HTML, replacing each with grammatically-appropriate
 * punctuation so the prose still reads naturally.
 *
 * 2026-07-23. The em dash is a strong "AI-written" tell and it litters
 * the Word/Google-Docs-exported blog corpus (and, to a lesser extent,
 * product / collection / page bodies). This pass strips every em-dash
 * form from the *visible prose* while preserving every word.
 *
 * The only real decision per dash is period vs comma. Rules:
 *   0. A lone divider paragraph `<p>—</p>` is removed outright.
 *   1. If the following word is Capitalized in the source → PERIOD,
 *      keep the word. This nails the `<strong>Label</strong> — Definition`
 *      pseudo-definition-lists that dominate these articles, plus
 *      mid-flow sentence breaks (`… — The internal clock …`).
 *   2. If the following word is lowercase and an independent-clause
 *      starter (INDEP set: they/it/you/this/there/…) → PERIOD, then
 *      capitalize it.
 *   3. Otherwise → COMMA (appositives, "— and …", "— from …", etc.).
 *
 * Only U+2014 forms are matched: the literal char, `&mdash;`,
 * `&#8212;`, `&#x2014;`. EN dashes (–, U+2013) in ranges — "7–10 years",
 * "$500–$1,200", "65–68°F" — are NEVER touched.
 *
 * SAFETY — this pass edits visible prose, so it is gated harder than
 * the surgical link-cleanup script:
 *   - Visible-text skeleton (tags + entities stripped, lowercased,
 *     alnum-only) MUST be byte-identical before/after. That proves only
 *     punctuation/case changed — no word added, dropped, or reordered.
 *     Any item whose skeleton shifts is SKIPPED and flagged, never
 *     written.
 *   - HTML tag balance (<a>/<p>) must hold.
 *   - Apply path is SHA-verified with a whitespace-normalized fallback
 *     (Shopify pretty-prints some HTML server-side), and auto-restores
 *     the original on real corruption. Restore is itself verified.
 *
 * Dry-run by default; the report captures up to SAMPLE_CTX before/after
 * windows per item so the diffs can be reviewed before applying.
 * Idempotent: re-running on already-clean content is a no-op.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=… SHOPIFY_ADMIN_TOKEN=… \
 *     node scripts/seo-emdash-cleanup.mjs                       # dry-run, all articles
 *   … node scripts/seo-emdash-cleanup.mjs --resource=products  # dry-run, all products
 *   … node scripts/seo-emdash-cleanup.mjs <handle> [<handle>…]  # dry-run named items
 *   … node scripts/seo-emdash-cleanup.mjs --apply              # write all articles
 *   … node scripts/seo-emdash-cleanup.mjs --apply --limit=20   # write first 20 changed
 *
 * Required Admin scopes: read_content + write_content (articles/blogs),
 * read_products + write_products (products/collections),
 * read_online_store_pages + write_online_store_pages (pages).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = '2024-10';
const APPLY = process.argv.includes('--apply');
const SAMPLE_CTX = 6; // max before/after context windows recorded per item

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN');
  process.exit(1);
}

// ---- transform (kept in lock-step with the validated scratch module) ----

const INDEP = new Set([
  'they', 'it', 'you', 'we', 'this', 'these', 'those', 'that', 'there',
  'most', 'some', 'many', 'i', 'he', 'she', 'your', 'our', 'its', 'their',
  'his', 'her', 'then', 'now', 'today', 'here',
]);

const EMDASH_CLASS = '(?:\\u2014|&mdash;|&#8212;|&#x2014;)';
const EMDASH_G = new RegExp(EMDASH_CLASS, 'g');

function stripEmDashes(html) {
  let b = html;
  // 0. Lone divider paragraphs.
  b = b.replace(new RegExp(`<p>\\s*${EMDASH_CLASS}\\s*</p>\\s*`, 'g'), '');
  // 1–3. Dash + following word.
  b = b.replace(new RegExp(`\\s*${EMDASH_CLASS}\\s*(\\S+)`, 'g'), (match, word) => {
    const lead = word.match(/^(?:<[^>]+>|&[a-z]+;|["'“”‘’(*]+)*/);
    const rest = word.slice(lead ? lead[0].length : 0);
    const firstAlpha = rest.match(/[A-Za-z]/);
    if (firstAlpha && firstAlpha[0] === firstAlpha[0].toUpperCase()) {
      return `. ${word}`;
    }
    const lc = (rest.match(/^[a-z]+/) || [''])[0];
    if (INDEP.has(lc)) {
      const idx = word.length - rest.length;
      return `. ${word.slice(0, idx) + rest.charAt(0).toUpperCase() + rest.slice(1)}`;
    }
    return `, ${word}`;
  });
  return b;
}

const skeleton = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z0-9#]+;/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const normalize = (s) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
const countEm = (s) => (s.match(EMDASH_G) || []).length;

/** Collect up to SAMPLE_CTX before/after context windows around each dash. */
function contexts(before, after) {
  const out = [];
  const re = new RegExp(EMDASH_CLASS, 'g');
  let m;
  while ((m = re.exec(before)) && out.length < SAMPLE_CTX) {
    const i = m.index;
    out.push({ before: before.slice(Math.max(0, i - 45), i + m[0].length + 45) });
  }
  // pair each with the transformed neighbourhood is hard to align 1:1;
  // record a full-ish diff sample instead: the first divergence window.
  let d = 0;
  while (d < before.length && d < after.length && before[d] === after[d]) d++;
  if (d < before.length || d < after.length) {
    out.unshift({
      firstChangeBefore: before.slice(Math.max(0, d - 40), d + 60),
      firstChangeAfter: after.slice(Math.max(0, d - 40), d + 60),
    });
  }
  return out;
}

function balanceCheck(s) {
  const aOpens = (s.match(/<a\s/g) || []).length;
  const aCloses = (s.match(/<\/a>/g) || []).length;
  const pOpens = (s.match(/<p[\s>]/g) || []).length;
  const pCloses = (s.match(/<\/p>/g) || []).length;
  return { aOk: aOpens === aCloses, pOk: pOpens === pCloses, aOpens, aCloses, pOpens, pCloses };
}

// ---- Shopify GraphQL ----

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

/**
 * Per-resource config. `bodyField` is the HTML field carrying prose.
 * `list` paginates every item; `fetchOne` gets one by handle; `update`
 * writes the body back. All return { id, handle, title, body }.
 */
const RESOURCES = {
  articles: {
    bodyField: 'body',
    async *list() {
      let after = null;
      do {
        const d = await gql(
          `query A($after: String) { articles(first: 100, after: $after) {
             nodes { id handle title body } pageInfo { hasNextPage endCursor } } }`,
          { after },
        );
        for (const n of d.articles.nodes) yield n;
        after = d.articles.pageInfo.hasNextPage ? d.articles.pageInfo.endCursor : null;
      } while (after);
    },
    async fetchOne(handle) {
      const d = await gql(
        `query F($q: String!) { articles(first: 1, query: $q) { nodes { id handle title body } } }`,
        { q: `handle:${handle}` },
      );
      return d.articles.nodes[0] || null;
    },
    async update(id, body) {
      const d = await gql(
        `mutation U($id: ID!, $article: ArticleUpdateInput!) {
           articleUpdate(id: $id, article: $article) { article { id updatedAt } userErrors { field message } } }`,
        { id, article: { body } },
      );
      if (d.articleUpdate.userErrors.length) throw new Error(JSON.stringify(d.articleUpdate.userErrors));
    },
  },
  products: {
    bodyField: 'descriptionHtml',
    async *list() {
      let after = null;
      do {
        const d = await gql(
          `query P($after: String) { products(first: 100, after: $after) {
             nodes { id handle title descriptionHtml } pageInfo { hasNextPage endCursor } } }`,
          { after },
        );
        for (const n of d.products.nodes) yield { id: n.id, handle: n.handle, title: n.title, body: n.descriptionHtml };
        after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
      } while (after);
    },
    async fetchOne(handle) {
      const d = await gql(
        `query F($q: String!) { products(first: 1, query: $q) { nodes { id handle title descriptionHtml } } }`,
        { q: `handle:${handle}` },
      );
      const n = d.products.nodes[0];
      return n ? { id: n.id, handle: n.handle, title: n.title, body: n.descriptionHtml } : null;
    },
    async update(id, body) {
      const d = await gql(
        `mutation U($input: ProductInput!) {
           productUpdate(input: $input) { product { id updatedAt } userErrors { field message } } }`,
        { input: { id, descriptionHtml: body } },
      );
      if (d.productUpdate.userErrors.length) throw new Error(JSON.stringify(d.productUpdate.userErrors));
    },
  },
  collections: {
    bodyField: 'descriptionHtml',
    async *list() {
      let after = null;
      do {
        const d = await gql(
          `query C($after: String) { collections(first: 100, after: $after) {
             nodes { id handle title descriptionHtml } pageInfo { hasNextPage endCursor } } }`,
          { after },
        );
        for (const n of d.collections.nodes) yield { id: n.id, handle: n.handle, title: n.title, body: n.descriptionHtml };
        after = d.collections.pageInfo.hasNextPage ? d.collections.pageInfo.endCursor : null;
      } while (after);
    },
    async fetchOne(handle) {
      const d = await gql(
        `query F($q: String!) { collections(first: 1, query: $q) { nodes { id handle title descriptionHtml } } }`,
        { q: `handle:${handle}` },
      );
      const n = d.collections.nodes[0];
      return n ? { id: n.id, handle: n.handle, title: n.title, body: n.descriptionHtml } : null;
    },
    async update(id, body) {
      const d = await gql(
        `mutation U($input: CollectionInput!) {
           collectionUpdate(input: $input) { collection { id updatedAt } userErrors { field message } } }`,
        { input: { id, descriptionHtml: body } },
      );
      if (d.collectionUpdate.userErrors.length) throw new Error(JSON.stringify(d.collectionUpdate.userErrors));
    },
  },
  pages: {
    bodyField: 'body',
    async *list() {
      let after = null;
      do {
        const d = await gql(
          `query G($after: String) { pages(first: 100, after: $after) {
             nodes { id handle title body } pageInfo { hasNextPage endCursor } } }`,
          { after },
        );
        for (const n of d.pages.nodes) yield n;
        after = d.pages.pageInfo.hasNextPage ? d.pages.pageInfo.endCursor : null;
      } while (after);
    },
    async fetchOne(handle) {
      const d = await gql(
        `query F($q: String!) { pages(first: 1, query: $q) { nodes { id handle title body } } }`,
        { q: `handle:${handle}` },
      );
      return d.pages.nodes[0] || null;
    },
    async update(id, body) {
      const d = await gql(
        `mutation U($id: ID!, $page: PageUpdateInput!) {
           pageUpdate(id: $id, page: $page) { page { id updatedAt } userErrors { field message } } }`,
        { id, page: { body } },
      );
      if (d.pageUpdate.userErrors.length) throw new Error(JSON.stringify(d.pageUpdate.userErrors));
    },
  },
};

// ---- main ----

const argResource = process.argv.find((a) => a.startsWith('--resource='));
const resourceName = argResource ? argResource.slice('--resource='.length) : 'articles';
if (!RESOURCES[resourceName]) {
  console.error(`Unknown --resource="${resourceName}". Known: ${Object.keys(RESOURCES).join(', ')}`);
  process.exit(1);
}
const R = RESOURCES[resourceName];
const argLimit = process.argv.find((a) => a.startsWith('--limit='));
const limit = argLimit ? parseInt(argLimit.slice('--limit='.length), 10) : Infinity;
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
const mode = APPLY ? 'apply' : 'dryrun';
const reportPath = resolve(OUT_DIR, `emdash-cleanup-${ts}-${resourceName}-${mode}.json`);
const report = { ts, mode, resource: resourceName, results: [], totals: {} };

async function processItem(item) {
  const r = { handle: item.handle, id: item.id, title: item.title, status: 'unknown' };
  const orig = item.body || '';
  const emBefore = countEm(orig);
  r.emBefore = emBefore;
  if (emBefore === 0) {
    r.status = 'NO_EMDASH';
    return r;
  }
  const cleaned = stripEmDashes(orig);
  r.emAfter = countEm(cleaned);
  r.delta = cleaned.length - orig.length;

  // HARD gate: visible-text skeleton must be identical.
  if (skeleton(orig) !== skeleton(cleaned)) {
    r.status = 'SKELETON_CHANGED_SKIP';
    r.contexts = contexts(orig, cleaned);
    console.error(`SKIP ${item.handle}: visible-text skeleton changed — not writing`);
    return r;
  }
  if (r.emAfter !== 0) {
    r.status = 'EMDASH_REMAINS_SKIP';
    console.error(`SKIP ${item.handle}: ${r.emAfter} em dash(es) survived transform`);
    return r;
  }
  const bal = balanceCheck(cleaned);
  if (!bal.aOk || !bal.pOk) {
    r.status = 'UNBALANCED_SKIP';
    r.balanced = bal;
    console.error(`SKIP ${item.handle}: HTML unbalanced after transform`);
    return r;
  }
  r.contexts = contexts(orig, cleaned);

  if (!APPLY) {
    r.status = 'DRY_RUN_CLEAN';
    console.log(`DRY ${item.handle}: ${emBefore} em dash(es) → clean`);
    return r;
  }

  // APPLY
  const origSha = sha256(orig);
  const newSha = sha256(cleaned);
  await R.update(item.id, cleaned);
  const after = await R.fetchOne(item.handle);
  const liveSha = sha256(after.body);
  if (liveSha === newSha) {
    r.status = 'APPLIED_SHA_MATCH';
    console.log(`APPLY ${item.handle}: sha match`);
  } else if (normalize(after.body) === normalize(cleaned)) {
    r.status = 'APPLIED_SEMANTIC_MATCH';
    console.log(`APPLY ${item.handle}: semantic match (shopify normalized)`);
  } else if (countEm(after.body) === 0 && skeleton(after.body) === skeleton(orig)) {
    // Shopify reshaped HTML but the prose skeleton is intact and no em
    // dash survived — accept.
    r.status = 'APPLIED_SKELETON_MATCH';
    console.log(`APPLY ${item.handle}: skeleton match, 0 em dashes live`);
  } else {
    console.error(`MISMATCH ${item.handle}: restoring original`);
    await R.update(item.id, orig);
    const restored = await R.fetchOne(item.handle);
    if (sha256(restored.body) === origSha || normalize(restored.body) === normalize(orig)) {
      r.status = 'RESTORED_ORIGINAL';
    } else {
      r.status = 'RESTORE_FAILED_ESCALATE';
      r.origBodyBackup = orig;
      console.error(`CRITICAL ${item.handle}: restore failed; original saved in report`);
    }
  }
  return r;
}

let scanned = 0;
let changed = 0;
if (positional.length) {
  for (const handle of positional) {
    const item = await R.fetchOne(handle);
    if (!item) {
      report.results.push({ handle, status: 'NOT_FOUND' });
      console.log(`SKIP ${handle}: not found`);
      continue;
    }
    scanned++;
    const r = await processItem(item);
    if (r.status !== 'NO_EMDASH') report.results.push(r);
    if (r.status.startsWith('APPLIED') || r.status === 'DRY_RUN_CLEAN') changed++;
  }
} else {
  for await (const item of R.list()) {
    scanned++;
    const r = await processItem(item);
    if (r.status !== 'NO_EMDASH') {
      report.results.push(r);
      if (r.status.startsWith('APPLIED') || r.status === 'DRY_RUN_CLEAN') {
        changed++;
        if (changed >= limit) break;
      }
    }
  }
}

report.totals = {
  scanned,
  withEmDash: report.results.filter((r) => r.emBefore > 0).length,
  emDashesTotal: report.results.reduce((s, r) => s + (r.emBefore || 0), 0),
  applied: report.results.filter((r) => r.status.startsWith('APPLIED')).length,
  dryRunClean: report.results.filter((r) => r.status === 'DRY_RUN_CLEAN').length,
  skipped: report.results.filter((r) => r.status.endsWith('SKIP')).length,
  restored: report.results.filter((r) => r.status.startsWith('RESTORE')).length,
};

await mkdir(OUT_DIR, { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\nTotals:`, report.totals);
console.log(`Report written: ${reportPath}`);

const escalate = report.results.filter(
  (r) => r.status === 'RESTORE_FAILED_ESCALATE' || r.status === 'UNBALANCED_SKIP',
);
if (escalate.length) process.exit(2);
