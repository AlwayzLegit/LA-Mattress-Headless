#!/usr/bin/env node
/**
 * seo-article-cleanup.mjs — Surgical cleanup of Word-exported blog
 * article body HTML.
 *
 * 2026-05-20 follow-on to SEO improvement plan Phases 4 + 5. The
 * cluster-consolidation work (#182 / #183) flagged that several
 * near-miss blog articles import Word HTML with significant
 * SEO-harmful patterns:
 *
 *   - Parasitic `<a href="#:~:text=…">` Google Text Fragment anchors
 *     (point to non-existent same-page text; confuse crawlers).
 *   - Empty `<p><b id="docs-internal-guid-…"></b></p>` paragraph
 *     placeholders left by Google Docs export.
 *   - Empty anchor tags clustered under H2 headings.
 *   - External outbound links to competitor / affiliate-monetized
 *     domains (sleepfoundation, healthline, nilkamalsleep, naplab,
 *     whitelotushome, bryte, livingspaces, zomasleep, etc.) bleeding
 *     authority from commercial-intent pages.
 *   - Self-301 chains where an article links to a handle that the P0
 *     batch (#183) now 301s back to itself.
 *   - Tracking-param URLs (?srsltid=, ?utm_source=, including
 *     HTML-entity-encoded &amp;srsltid= / &amp;utm_source= variants)
 *     that robots.txt disallows for crawling.
 *   - Hardcoded outdated years in H2 headings.
 *
 * This script applies deterministic regex passes that strip those
 * patterns while preserving every word of the visible content. It
 * does NOT rewrite the articles — content edits remain a merchant
 * job.
 *
 * Dry-run by default. Pass --apply to write back via `articleUpdate`.
 * Each --apply run:
 *   1. Fetches the live body.
 *   2. Applies all cleanup passes (idempotent — no-op if already clean).
 *   3. Computes the expected SHA256 of the new body.
 *   4. Sends `articleUpdate`.
 *   5. Re-fetches and SHA-compares. On mismatch, falls back to
 *      whitespace-normalized equality (Shopify normalizes some HTML
 *      whitespace server-side; that's benign, not corruption — same
 *      situation the 2026-05-19 full-vs-queen-mattress enrichment hit
 *      with its compact `<tr><td>` table).
 *   6. If even normalized equality fails, restores the original body
 *      and exits non-zero. Restore is itself SHA-verified.
 *
 * Output: `data/seo-backfills/article-cleanup-{timestamp}-{dryrun|apply}.json`
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-article-cleanup.mjs                # dry-run all 5 defaults
 *
 *   SHOPIFY_STORE_DOMAIN=… SHOPIFY_ADMIN_TOKEN=… \
 *     node scripts/seo-article-cleanup.mjs <handle>       # dry-run one handle
 *
 *   SHOPIFY_STORE_DOMAIN=… SHOPIFY_ADMIN_TOKEN=… \
 *     node scripts/seo-article-cleanup.mjs --apply <handle>      # write one
 *
 *   SHOPIFY_STORE_DOMAIN=… SHOPIFY_ADMIN_TOKEN=… \
 *     node scripts/seo-article-cleanup.mjs --apply                # write all 5 defaults
 *
 * Required Admin scopes: read_content, write_content,
 * read_online_store_pages, write_online_store_pages.
 *
 * Idempotent: re-running on an already-clean article is a no-op.
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

/**
 * Default target list: the 5 near-miss blog articles flagged in
 * `docs/seo-followup-tasks.md` §6 that share the Word-export cruft
 * pattern. Pass a handle as a positional CLI arg to override.
 */
const DEFAULT_HANDLES = [
  'what-s-the-difference-between-eastern-king-and-california-king',
  'englander-mattress-reviews-2024',
  'ultimate-sam-s-club-queen-mattress-review-pros-cons-and-top-picks',
  'sealy-vs-serta-mattress-which-brand-delivers-the-best-sleep',
  'how-much-should-you-spend-on-a-mattress',
];

const ENDPOINT = `https://${STORE}/admin/api/${VERSION}/graphql.json`;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seo-backfills');

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * Whitespace-normalized form for equality testing against Shopify's
 * server-side HTML pretty-printer. Collapses whitespace between tags
 * and runs of whitespace within text. Mirrors the "semantic identity"
 * proof used for the 2026-05-19 full-vs-queen-mattress enrichment.
 */
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

async function fetchArticle(handle) {
  const Q = `query F($q: String!) {
    articles(first: 1, query: $q) {
      nodes { id handle title body isPublished updatedAt }
    }
  }`;
  const d = await gql(Q, { q: `handle:${handle}` });
  return d.articles.nodes[0] || null;
}

async function updateArticleBody(id, body) {
  const M = `mutation U($id: ID!, $article: ArticleUpdateInput!) {
    articleUpdate(id: $id, article: $article) {
      article { id handle updatedAt }
      userErrors { field message }
    }
  }`;
  const d = await gql(M, { id, article: { body } });
  if (d.articleUpdate.userErrors.length) {
    throw new Error(`userErrors: ${JSON.stringify(d.articleUpdate.userErrors)}`);
  }
  return d.articleUpdate.article;
}

/**
 * Apply the deterministic cleanup passes. Each pass is a single
 * regex transform. Returns the transformed body. `counts` is mutated
 * to record per-pass match counts (useful for the dry-run report).
 *
 * The passes are intentionally surgical — they unwrap or strip
 * SEO-harmful HTML wrappers but never touch user-visible prose. A
 * re-run on already-clean output is a no-op (idempotent).
 */
function clean(body, counts) {
  let b = body;
  const pc = (name, re, replace) => {
    const m = b.match(re);
    counts[name] = (counts[name] || 0) + (m ? m.length : 0);
    b = b.replace(re, replace);
  };

  // 1. Drop empty Google-Docs export `docs-internal-guid` placeholders.
  pc('guid_placeholders',
     /<p><b id="docs-internal-guid-[^"]+"><\/b><\/p>\s*/g, '');

  // 2. Unwrap parasitic <a href="#:~:text=…"> anchors (keep inner text).
  pc('text_fragment_unwraps',
     /<a href="#:~:text=[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1');

  // 3. Self-301 unwrap: links to /blogs/mattress-buying-guide/king-vs-california-king
  //    are circular after #183 (it now 301s back to its hub).
  pc('self_301_unwraps',
     /<a href="https:\/\/mattressstoreslosangeles\.com\/blogs\/mattress-buying-guide\/king-vs-california-king[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1');

  // 4. Unwrap external (non-mattressstoreslosangeles.com) anchors — keep visible text.
  pc('external_unwraps',
     /<a href="https?:\/\/(?!(?:www\.)?mattressstoreslosangeles\.com)[^"]+"[^>]*>([\s\S]*?)<\/a>/g, '$1');

  // 5. Strip empty anchor tags that may remain after the unwraps.
  pc('empty_anchors',
     /<a href="[^"]+">(?:\s*<(?:strong|span|b|em)>\s*(?:<(?:strong|span|b|em)>\s*<\/(?:strong|span|b|em)>\s*)?<\/(?:strong|span|b|em)>\s*)*<\/a>/g, '');

  // 6. Strip tracking params in URL query strings — both literal `&`
  //    and HTML-entity `&amp;` variants. robots.txt already disallows
  //    crawling these param-laden URLs, so they're crawl-budget waste.
  pc('strip_srsltid_lit', /([?&])srsltid=[^"&]*(?=["&]|&amp;)/g, '$1');
  pc('strip_srsltid_ent', /&amp;srsltid=[^"&]*(?=["&]|&amp;)/g, '');
  pc('strip_utm_lit',     /([?&])utm_source=[^"&]*(?=["&]|&amp;)/g, '$1');
  pc('strip_utm_ent',     /&amp;utm_source=[^"&]*(?=["&]|&amp;)/g, '');

  // 7. Clean orphan query-string artifacts left by step 6 (e.g. `?&`,
  //    `?&amp;`, `?amp;`, or a trailing `?` right before `"` / `#`).
  pc('orphan_amp_chain',  /\?(&|&amp;|amp;)+/g, '?');
  pc('orphan_trailing_q', /\?(?=["#])/g, '');

  // 8. Refresh hardcoded outdated year in section headings.
  pc('year_refresh',
     /Best Eastern &amp; California King Mattresses to Buy in 2025/g,
     'Best Eastern &amp; California King Mattresses to Buy in 2026');

  return b;
}

function balanceCheck(s) {
  const aOpens = (s.match(/<a\s/g) || []).length;
  const aCloses = (s.match(/<\/a>/g) || []).length;
  const pOpens = (s.match(/<p[\s>]/g) || []).length;
  const pCloses = (s.match(/<\/p>/g) || []).length;
  return {
    aOk: aOpens === aCloses,
    pOk: pOpens === pCloses,
    aOpens, aCloses, pOpens, pCloses,
  };
}

// ====== main ======
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const handles = positional.length ? positional : DEFAULT_HANDLES;
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
const mode = APPLY ? 'apply' : 'dryrun';
const reportPath = resolve(OUT_DIR, `article-cleanup-${ts}-${mode}.json`);

const report = { ts, mode, handles, results: [] };

for (const handle of handles) {
  const r = { handle, status: 'unknown' };
  try {
    const a = await fetchArticle(handle);
    if (!a) {
      r.status = 'NOT_FOUND';
      console.log(`SKIP ${handle}: not found`);
      report.results.push(r);
      continue;
    }
    r.id = a.id;
    r.title = a.title;
    r.origUpdatedAt = a.updatedAt;
    r.origLen = a.body.length;
    r.origSha = sha256(a.body);
    const counts = {};
    const cleaned = clean(a.body, counts);
    r.passCounts = counts;
    r.newLen = cleaned.length;
    r.newSha = sha256(cleaned);
    r.delta = cleaned.length - a.body.length;
    if (cleaned === a.body) {
      r.status = 'NO_CHANGES_NEEDED';
      console.log(`OK ${handle}: already clean`);
      report.results.push(r);
      continue;
    }
    const bal = balanceCheck(cleaned);
    r.balanced = bal;
    if (!bal.aOk || !bal.pOk) {
      r.status = 'UNBALANCED_AFTER_CLEANUP';
      console.error(`ABORT ${handle}: HTML unbalanced after cleanup`, bal);
      report.results.push(r);
      continue;
    }
    if (!APPLY) {
      r.status = 'DRY_RUN_CLEAN';
      console.log(`DRY ${handle}: would strip ${-r.delta} chars`, counts);
      report.results.push(r);
      continue;
    }

    // APPLY path
    await updateArticleBody(a.id, cleaned);
    const after = await fetchArticle(handle);
    r.liveAfterUpdatedAt = after.updatedAt;
    r.liveAfterLen = after.body.length;
    r.liveAfterSha = sha256(after.body);
    if (r.liveAfterSha === r.newSha) {
      r.status = 'APPLIED_SHA_MATCH';
      console.log(`APPLY ${handle}: sha match, clean`);
    } else if (normalize(after.body) === normalize(cleaned)) {
      r.status = 'APPLIED_SEMANTIC_MATCH';
      r.shopifyNormalizedDelta = after.body.length - cleaned.length;
      console.log(`APPLY ${handle}: shopify normalized HTML, semantic match (delta ${r.shopifyNormalizedDelta} bytes)`);
    } else {
      // Real corruption — restore original.
      console.error(`MISMATCH ${handle}: restoring original`);
      try {
        await updateArticleBody(a.id, a.body);
        const restored = await fetchArticle(handle);
        if (sha256(restored.body) === r.origSha) {
          r.status = 'RESTORED_ORIGINAL';
        } else if (normalize(restored.body) === normalize(a.body)) {
          r.status = 'RESTORED_SEMANTIC';
        } else {
          r.status = 'RESTORE_FAILED_ESCALATE';
          r.origBodyBackup = a.body;
          console.error(`CRITICAL ${handle}: could not restore via API; original body saved in report.results[].origBodyBackup`);
        }
      } catch (e) {
        r.status = 'RESTORE_THREW_ESCALATE';
        r.restoreError = e.message;
        r.origBodyBackup = a.body;
      }
    }
    report.results.push(r);
  } catch (e) {
    r.status = 'EXCEPTION';
    r.error = e.message;
    console.error(`ERROR ${handle}: ${e.message}`);
    report.results.push(r);
  }
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReport written: ${reportPath}`);

const escalate = report.results.filter(
  (r) =>
    r.status === 'RESTORE_FAILED_ESCALATE' ||
    r.status === 'RESTORE_THREW_ESCALATE' ||
    r.status === 'UNBALANCED_AFTER_CLEANUP',
);
if (escalate.length) process.exit(2);
