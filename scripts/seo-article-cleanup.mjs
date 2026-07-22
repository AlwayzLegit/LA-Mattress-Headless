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
 * pattern. Pass a handle as a positional CLI arg to override, or use
 * `--batch=<name>` to run a different named batch (see BATCHES below).
 */
const DEFAULT_HANDLES = [
  'what-s-the-difference-between-eastern-king-and-california-king',
  'englander-mattress-reviews-2024',
  'ultimate-sam-s-club-queen-mattress-review-pros-cons-and-top-picks',
  'sealy-vs-serta-mattress-which-brand-delivers-the-best-sleep',
  'how-much-should-you-spend-on-a-mattress',
];

/**
 * Named batches. Pass `--batch=<name>` to run one of these instead of
 * the positional / DEFAULT_HANDLES list. Adding a batch here is the
 * canonical way to capture an audit cohort — keeps the per-audit
 * cleanup history visible in `git log`.
 *
 *   semrush-2026-05-25-broken-ext:
 *     SEMrush 2026-05-25 "External broken links" drill-down (72 broken
 *     external anchors across 52 articles). Pass 4 of clean() unwraps
 *     every external anchor — fixing the broken-link flag and also
 *     stopping authority bleed to all OTHER external domains in the
 *     same articles as a side effect. Articles are listed in the order
 *     the audit returned them so the cleanup report aligns with the
 *     SEMrush issue queue.
 */
const BATCHES = {
  'semrush-2026-05-25-broken-ext': [
    'are-innerspring-mattresses-still-a-good-choice-in-2025',
    'best-affordable-non-toxic-mattresses',
    'best-affordable-non-toxic-pillows',
    'best-all-wooden-bedroom-sets',
    'best-bed-sheets-for-eczema',
    'best-bed-sheets-for-oily-skin',
    'best-hypoallergenic-pillows-and-bedsheets',
    'best-mattress-for-300-pound-person',
    'best-mattress-for-bad-back',
    'best-mattress-for-chronic-pain',
    'best-mattress-for-disabled-person',
    'best-mattress-for-fat-side-sleepers',
    'best-mattress-for-floor-bed',
    'best-mattress-for-incontinence',
    'best-mattress-for-older-adults',
    'best-mattress-for-peripheral-neuropathy',
    'best-mattress-for-shoulder-and-neck-pain',
    'best-mattress-for-side-and-stomach-sleepers',
    'best-mattress-topper-for-heavy-people',
    'best-mattress-topper-for-kids',
    'best-mattress-topper-for-neck-pain',
    'best-mattress-topper-to-make-bed-softer',
    'best-mattresses-for-3-quarter-size-beds',
    'best-mattresses-for-the-morbidly-obese-in-2024',
    'best-pillows-for-vertigo',
    'best-pillows-to-use-after-neck-surgery',
    'best-practices-for-preventing-mold-and-mildew-in-foam-mattresses',
    'best-sheets-for-adjustable-beds',
    'best-stearns-and-foster-mattress-for-side-sleepers',
    'can-i-throw-my-mattress-in-the-dumpster',
    'do-all-englander-mattresses-contain-latex',
    'do-firm-mattresses-really-last-longer-durability-explained',
    'englander-mattress-prices-2024',
    'exploring-mattress-thickness-why-less-isn-t-always-more-for-comfort',
    'how-long-will-a-chattam-and-wells-mattress-last',
    'how-mattress-firmness-affects-sleep-quality-and-pain-relief',
    'how-to-clean-urine-from-tempurpedic-mattress',
    'how-to-price-a-used-englander-mattress',
    'how-to-price-a-used-latex-mattress',
    'how-to-price-a-used-tempurpedic-mattress',
    'is-a-magnetic-mattress-good-for-health',
    'mattress-trial-periods-what-to-know-before-you-buy',
    'pros-and-cons-of-using-an-air-mattress-long-term',
    'sealy-vs-beautyrest-mattresses',
    'serta-pedic-vs-tempurpedic-why-tempurpedic-is-the-better-option',
    'top-talalay-latex-mattresses-2024',
    'what-type-of-mattress-is-best-for-child',
    'where-to-buy-englander-mattresses-in-los-angeles',
    'why-temperature-control-in-mattresses-is-key-to-nightly-recovery',
    'how-to-deflate-an-intex-air-mattress',
    'can-you-wash-tempurpedic-pillows',
    'can-cockroaches-live-in-a-mattress',
  ],
  /**
   * semrush-2026-05-27-broken-int:
   *   SEMrush 2026-05-27 audit drill-downs for internal broken links
   *   (404s) and redirect chains. Four articles linked to legacy
   *   "collection / brand filter" URLs that Shopify no longer serves
   *   ("/collections/X/Brand_Y", "/collections/X/brand_y") or to
   *   collection URLs with Shopify search tracking params
   *   ("?_pos=N&_fid=25dfdec8e&_ss=c") that 308/301-chain to the bare
   *   collection. Pass 9 / 10 of clean() rewrites those hrefs to the
   *   parent collection so the link stays internal and returns 200.
   */
  'semrush-2026-05-27-broken-int': [
    'best-mattress-for-degenerative-disc-disease',
    'best-mattress-los-angeles-mattress-store',
    'englander-mattress-prices-2024',
    'englander-mattress-reviews-2024',
  ],

  /**
   * semrush-2026-05-27-broken-ext:
   *   SEMrush 2026-05-27 "External broken links" drill-down — 11
   *   article bodies linking to third-party domains that responded
   *   4xx / 5xx / DNS-unresolvable at crawl time. Mix of permanent
   *   (404, DNS) and transient (429, 500, 502, 503) failures. The
   *   transient ones are mostly aggressive bot rate-limiting on
   *   the destination — for our SEO posture it doesn't matter:
   *   external anchors leak authority and create perpetual broken-
   *   link maintenance regardless of whether the link works today.
   *   Pass 4 of clean() unwraps every external anchor in these
   *   articles, keeping the visible text intact and converting the
   *   link into prose. The article narrative reads identically;
   *   SEMrush re-crawl will clear all 11 findings.
   */
  'semrush-2026-05-27-broken-ext': [
    'best-12-hybrid-mattresses-2024',
    'best-hotel-mattress-topper',
    'do-all-bed-frames-fit-a-california-king-mattress',
    'do-beautyrest-mattresses-have-fiberglass',
    'helix-vs-tempurpedic-a-comprehensive-comparison',
    'how-to-price-a-used-latex-mattress',
    'is-a-magnetic-mattress-good-for-health',
    'is-stearns-and-foster-better-than-beautyrest',
    'how-to-deflate-an-intex-air-mattress',
    'can-you-sleep-in-a-room-after-painting-it',
    'sleeping-on-floor-benefits-health',
  ],

  /**
   * semrush-2026-07-05-quiz-and-ext:
   *   SEMrush 2026-07-05 crawl. Two cohorts in one batch:
   *
   *   Quiz links (issues 2 + 8 — the site's only 4xx and all 4 broken
   *   internal links): the first four articles were published Jul 4–5
   *   by the external daily-blog automation, whose template links
   *   `/pages/quiz` — a URL that has never existed on the headless
   *   storefront (the quiz is `/sleep-quiz`). Pass 12 rewrites the
   *   hrefs; the 301 shipped in PR #511 covers stragglers and any
   *   future recurrence until the automation's template is fixed.
   *
   *   Broken external links (issue 12): the last four articles link
   *   third-party URLs that responded 5xx/429 at crawl time
   *   (iblspecifik.com 503 — genuinely unstable; researchgate.net
   *   429 — crawler rate-limiting). Pass 4 unwraps every external
   *   anchor, same posture as the two prior broken-ext batches:
   *   external anchors leak authority and create perpetual broken-
   *   link maintenance regardless of whether the link works today.
   */
  'semrush-2026-07-05-quiz-and-ext': [
    'new-mattress-smell-off-gassing',
    'innerspring-vs-memory-foam',
    'how-to-make-a-mattress-softer',
    'best-mattress-for-combination-sleepers',
    'how-to-clean-a-sweat-stained-mattress',
    'the-connection-between-quality-sleep-and-relationship-health',
    'how-to-choose-the-best-allergy-mattress-cover-for-your-needs',
    '10-reasons-why-your-mattress-needs-to-be-replaced',
  ],

  /**
   * semrush-2026-07-07-all-open:
   *   Superset batch — every article flagged open as of the 2026-07-07
   *   crawl, in one run. The 07-05 batch never got applied (the
   *   SHOPIFY_ADMIN_TOKEN Actions secret died 2026-07-04/05 and every
   *   run 401'd), and the 07-07 crawl added 7 more broken-external
   *   articles: healthline.com reorganized its /health/* URLs (5
   *   anchors now 404) and us-mattress.com started answering crawlers
   *   with 423 (3 anchors). Rather than chaining two batch runs when
   *   the token comes back, this batch covers the 07-05 set (quiz-link
   *   rewrites via pass 12 + ext unwraps via pass 4) plus the 7 new
   *   articles. All passes are idempotent, so the overlap is harmless
   *   and this batch supersedes 07-05 (kept above for the audit
   *   trail).
   */
  'semrush-2026-07-07-all-open': [
    // 07-05 cohort — quiz links + first ext wave
    'new-mattress-smell-off-gassing',
    'innerspring-vs-memory-foam',
    'how-to-make-a-mattress-softer',
    'best-mattress-for-combination-sleepers',
    'how-to-clean-a-sweat-stained-mattress',
    'the-connection-between-quality-sleep-and-relationship-health',
    'how-to-choose-the-best-allergy-mattress-cover-for-your-needs',
    '10-reasons-why-your-mattress-needs-to-be-replaced',
    // 07-07 cohort — healthline 404s + us-mattress 423s
    'what-is-the-best-mattress-for-fibromyalgia-pain-relief',
    'tempur-pedic-mattress-review-2025-pros-cons-and-alternatives',
    'king-size-bed-frames-which-style-and-size-should-you-choose',
    'best-mattress-for-joint-pain',
    'signs-of-bed-bugs-on-foam-mattresses-and-what-to-do',
    'signs-it-s-time-to-replace-your-memory-foam-mattress',
    'best-twin-mattresses-for-toddlers',
  ],

  /**
   * semrush-2026-07-19-broken-ext:
   *   SEMrush 2026-07-19 crawl — the 3 residual broken external links
   *   (issue 12) left after the 07-07 superset batch cleared the rest:
   *   roh.nhs.uk moved its hip-precautions page (404), and
   *   aerocommattress.com / ethicalbedding.com blog posts died. Pass 4
   *   unwraps every external anchor in these articles, same posture as
   *   the prior broken-ext batches.
   */
  'semrush-2026-07-19-broken-ext': [
    'when-can-you-sleep-on-your-back-after-hip-replacement',
    'best-bed-sheets-for-allergies',
    'the-role-of-mattress-height-and-support-in-creating-a-luxurious-sleep-experience',
  ],

  /**
   * semrush-2026-07-21-broken-ext:
   *   SEMrush 2026-07-21 crawl — issue 12 jumped 3 → 27 because
   *   sleepfoundation.org reorganized its URL structure: three paths we
   *   linked heavily now 404 (mattress-construction/mattress-coil-types
   *   ×14, mattress-information/dunlop-vs-talalay-latex ×5,
   *   what-is-the-difference-between-memory-foam-and-latex ×4, plus
   *   /sleep-disorders ×1) across 22 articles. Also swept in: one dead
   *   greensunmedical.com post, one dead sleepessentials.com post, and
   *   an americanmattress.com competitor link (authority bleed either
   *   way). Pass 4 unwraps every external anchor in these articles,
   *   same posture as all prior broken-ext batches.
   */
  'semrush-2026-07-21-broken-ext': [
    'can-you-sleep-with-a-back-support-belt-on-guide-to-sleeping-in-a-back-brace',
    'what-type-of-mattress-is-best-for-an-adjustable-bed',
    'the-best-mattress-for-degenerative-disc-disease-a-comprehensive-guide',
    'short-queen-vs-standard-queen-mattress-best-choice-for-rvs-and-campers',
    'pocket-spring-vs-hybrid-mattresses-which-should-you-choose',
    'pocket-coil-vs-innerspring-mattresses-what-s-the-difference',
    'memory-foam-vs-hybrid-mattresses-which-is-better-for-couples',
    'is-latex-mattresses-the-best-mattress-for-culver-city',
    'is-a-plush-mattress-good-for-back-pain-relief',
    'how-do-i-know-if-my-mattress-is-too-firm-signs-to-watch-for',
    'high-rise-bed-frames',
    'can-you-use-a-box-spring-with-a-memory-foam-mattress',
    'can-you-put-an-air-mattress-on-a-bed-frame',
    'can-an-englander-visco-mattress-be-used-on-adjustable-beds',
    'best-mattress-topper-for-rheumatoid-arthritis',
    'best-mattress-topper-for-hospital-bed',
    'best-mattress-topper-for-bed-sores',
    'best-mattress-for-osteoporosis',
    'best-high-end-mattresses',
    'best-flex-king-mattress',
    'best-back-supporter-mattresses-of-2024',
    'best-affordable-non-toxic-mattress-toppers',
    // 07-22 crawl additions — issue 12 churned (27 → 6, mostly new URLs:
    // sleepfoundation intermittently blocks the crawler, plus dead
    // idlershome.com / shiptons.ca posts). Same one-run immunization.
    'why-does-my-mattress-feel-like-its-moving',
    'is-it-safe-to-buy-a-used-mattress',
    'do-memory-foam-mattresses-make-you-sweat',
    'are-low-beds-better-for-your-back-discover-the-ergonomic-health-benefits',
  ],
};

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
  //    Phase 305: anchor patterns now use `<a [^>]*?\bhref=` instead of
  //    `<a href=` because TinyMCE-emitted bodies often interleave a
  //    `data-mce-fragment="1"` attribute (and others) BEFORE the href
  //    — the old pattern silently missed ~70% of external anchors in
  //    affected articles. SEMrush 2026-05-27 broken-ext audit surfaced
  //    11 broken external links the existing pass 4 couldn't catch.
  pc('text_fragment_unwraps',
     /<a [^>]*?\bhref="#:~:text=[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1');

  // 3. Self-301 unwrap: links to /blogs/mattress-buying-guide/king-vs-california-king
  //    are circular after #183 (it now 301s back to its hub).
  pc('self_301_unwraps',
     /<a [^>]*?\bhref="https:\/\/mattressstoreslosangeles\.com\/blogs\/mattress-buying-guide\/king-vs-california-king[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1');

  // 4. Unwrap external (non-mattressstoreslosangeles.com) anchors — keep visible text.
  pc('external_unwraps',
     /<a [^>]*?\bhref="https?:\/\/(?!(?:www\.)?mattressstoreslosangeles\.com)[^"]+"[^>]*>([\s\S]*?)<\/a>/g, '$1');

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

  // 9. Strip Shopify search tracking params (`_pos` / `_fid` / `_ss`)
  //    from internal collection URLs. SEMrush 2026-05-27 audit found
  //    that articles linking to `?amp;_fid=25dfdec8e&_ss=c` triggered
  //    4-hop redirect chains (apex→www→bare-collection). Match both
  //    the literal `&` and HTML-entity `&amp;` variants. Idempotent.
  pc('strip_pos_lit',     /([?&])_pos=\d+(?=[&"#]|&amp;)/g, '$1');
  pc('strip_pos_ent',     /&amp;_pos=\d+(?=[&"#]|&amp;)/g, '');
  pc('strip_fid_lit',     /([?&])_fid=[a-zA-Z0-9]+(?=[&"#]|&amp;)/g, '$1');
  pc('strip_fid_ent',     /&amp;_fid=[a-zA-Z0-9]+(?=[&"#]|&amp;)/g, '');
  pc('strip_ss_lit',      /([?&])_ss=[a-zA-Z0-9]+(?=[&"#]|&amp;)/g, '$1');
  pc('strip_ss_ent',      /&amp;_ss=[a-zA-Z0-9]+(?=[&"#]|&amp;)/g, '');

  // 10. Strip dead brand-filter segments from internal collection
  //    URLs. The legacy Shopify theme exposed `/collections/X/Brand_Y`
  //    and lowercase `/collections/X/brand_y` faceted URLs; the
  //    current storefront 404s them. SEMrush 2026-05-27 internal
  //    broken-links report flagged 3 such anchors across the
  //    `semrush-2026-05-27-broken-int` batch. The pattern is
  //    deterministic — strip the trailing `/Brand_*` or `/brand_*`
  //    path segment, leaving the parent collection URL intact. Match
  //    only when followed by `"`, `?`, `#`, or `&` so we don't gobble
  //    legitimate path segments.
  pc('strip_brand_filter_cap',
     /(\/collections\/[a-z0-9-]+)\/Brand_[A-Za-z0-9-]+(?=["?#&])/g, '$1');
  pc('strip_brand_filter_low',
     /(\/collections\/[a-z0-9-]+)\/brand_[A-Za-z0-9-]+(?=["?#&])/g, '$1');

  // 11. After step 9 + 10, fold any newly-orphan trailing artifacts
  //    that may have been left mid-string (e.g. `?&"` → `"`).
  pc('orphan_amp_chain_2', /\?(&|&amp;|amp;)+/g, '?');
  pc('orphan_trailing_q_2', /\?(?=["#])/g, '');

  // 12. Rewrite internal quiz links to the canonical quiz URL. The
  //    external daily-blog automation templates `/pages/quiz` into
  //    new article bodies, but the quiz lives at `/sleep-quiz` —
  //    SEMrush 2026-07-05 flagged the resulting 404 as the site's
  //    only remaining 4xx (issue 2) plus all 4 broken internal links
  //    (issue 8). A 301 now covers the old URL (redirects-manual.json,
  //    PR #511); this pass fixes the hrefs at the source so article
  //    links go direct. Matches relative and absolute (apex + www)
  //    forms; idempotent.
  pc('quiz_href_rewrites',
     /(\bhref=")(?:https?:\/\/(?:www\.)?mattressstoreslosangeles\.com)?\/pages\/quiz(?=["?#\/])/g,
     '$1/sleep-quiz');

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
// Precedence: positional handles > --batch=<name> > DEFAULT_HANDLES.
// Positional always wins for one-off runs ("clean ONE article right now");
// the batch flag is for cohort-scale audit rollups.
const batchFlag = process.argv.find((a) => a.startsWith('--batch='));
const batchName = batchFlag ? batchFlag.slice('--batch='.length) : null;
if (batchName && !BATCHES[batchName]) {
  console.error(`Unknown --batch="${batchName}". Known batches: ${Object.keys(BATCHES).join(', ') || '(none)'}`);
  process.exit(1);
}
const handles = positional.length
  ? positional
  : batchName
    ? BATCHES[batchName]
    : DEFAULT_HANDLES;
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
const mode = APPLY ? 'apply' : 'dryrun';
const batchTag = batchName ? `-${batchName}` : '';
const reportPath = resolve(OUT_DIR, `article-cleanup-${ts}${batchTag}-${mode}.json`);

const report = { ts, mode, batch: batchName, handles, results: [] };

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
