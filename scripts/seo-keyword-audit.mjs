#!/usr/bin/env node
/**
 * SEO keyword-coverage audit. Reads a Semrush "Ideas" export
 * (re-saved as CSV — Semrush exports natively in XLSX; open the file
 * in Excel/Sheets and Save As CSV first) and emits a per-page
 * checklist of which keywords are missing from which on-page
 * elements (<title> / <h1> / <meta description> / body copy).
 *
 * Closes 106 of the "missing target keyword" ideas in the 20260528
 * Semrush export. The script is data-pipeline only — the actual
 * fixes are merchant copy edits in Shopify Admin.
 *
 * Output columns:
 *   url, keyword,
 *   missing_in_title, missing_in_h1, missing_in_meta_desc, missing_in_body,
 *   current_seo_title, current_seo_description
 *
 * "Y" in a missing column means Semrush flagged the keyword as absent
 * from that element. "current_seo_title" / "current_seo_description"
 * come from the local URL inventory snapshot (data/url-inventory/),
 * so the merchant can see what's there now without opening Shopify.
 *
 * Usage:
 *   node scripts/seo-keyword-audit.mjs path/to/semrush-export.csv \
 *     > docs/seo-audits/keyword-audit-YYYYMMDD.csv
 *
 * The committed docs/seo-audits/keyword-audit-20260528.csv is the
 * snapshot for the 20260528 export — drop it into Excel / Google
 * Sheets, filter by URL, fix the flagged elements in Shopify.
 *
 * No XLSX parsing dependency on purpose — the standard Node runtime
 * doesn't ship a zip reader and the dashboard already runs lean. CSV
 * is one Save-As away from any analyst tool.
 */

import { readFileSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';

const SITE = 'https://www.mattressstoreslosangeles.com';
const SITE_NW = 'https://mattressstoreslosangeles.com';

if (argv.length < 3) {
  stderr.write('Usage: node scripts/seo-keyword-audit.mjs <semrush-export.csv>\n');
  exit(2);
}

const inputPath = argv[2];

// --- Load inventory for current seo.title / seo.description per URL.
function loadInventory() {
  const out = {};
  // Collections
  try {
    const collections = JSON.parse(readFileSync('data/url-inventory/collections.json', 'utf8'));
    for (const c of collections.collections ?? []) {
      out[`/collections/${c.handle}`] = {
        seoTitle: c.seoTitle ?? '',
        seoDescription: c.seoDescription ?? '',
      };
    }
  } catch (e) { stderr.write(`[warn] collections inventory not loaded: ${e.message}\n`); }
  // Pages
  try {
    const pages = JSON.parse(readFileSync('data/url-inventory/pages.json', 'utf8'));
    for (const p of pages.pages ?? []) {
      out[`/pages/${p.handle}`] = {
        seoTitle: p.seoTitle ?? '',
        seoDescription: p.seoDescription ?? '',
      };
    }
  } catch (e) { stderr.write(`[warn] pages inventory not loaded: ${e.message}\n`); }
  // Blog articles — nested under blogs[].articles[].
  try {
    const blogs = JSON.parse(readFileSync('data/url-inventory/blogs.json', 'utf8'));
    for (const b of blogs.blogs ?? []) {
      for (const a of b.articles ?? []) {
        out[`/blogs/${b.handle}/${a.handle}`] = {
          seoTitle: a.title ?? '',
          seoDescription: '', // not in snapshot; merchant looks up in Shopify
        };
      }
    }
  } catch (e) { stderr.write(`[warn] blogs inventory not loaded: ${e.message}\n`); }
  return out;
}

/**
 * Minimal CSV row parser. Handles double-quoted fields with embedded
 * commas + escaped double-quotes (RFC 4180). No external dep — the
 * Semrush export is a clean RFC 4180 CSV.
 */
function parseCsvLine(line) {
  const out = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { field += ch; }
    } else {
      if (ch === ',') { out.push(field); field = ''; }
      else if (ch === '"' && field === '') { inQ = true; }
      else { field += ch; }
    }
  }
  out.push(field);
  return out;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// --- Read + filter the export.
const csvText = readFileSync(inputPath, 'utf8');
const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0);
const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
const colUrl = header.indexOf('url');
const colKw  = header.indexOf('keyword');
const colIdea = header.indexOf('idea');
if (colUrl < 0 || colKw < 0 || colIdea < 0) {
  stderr.write(`[error] expected columns 'Url' / 'Keyword' / 'Idea'; got [${header.join(', ')}]\n`);
  exit(2);
}

const inv = loadInventory();
/** Map<`${url}|${keyword}`, {missingTitle, missingH1, missingMeta, missingBody}> */
const groups = new Map();

for (let i = 1; i < lines.length; i++) {
  const row = parseCsvLine(lines[i]);
  const url = row[colUrl] ?? '';
  const kw = row[colKw] ?? '';
  const idea = row[colIdea] ?? '';
  // Only the "doesn't contain target keyword" family.
  if (!idea.includes('does not contain your target keyword')) continue;
  const path = url.replace(SITE, '').replace(SITE_NW, '');
  const key = `${path}|${kw}`;
  const entry = groups.get(key) ?? { title: '', h1: '', meta: '', body: '' };
  // Classify by which element the idea is about. Order of checks
  // matters — "meta description" comes before "title" so we don't
  // misclassify the meta-description complaint as a title issue.
  if (idea.includes('meta description')) entry.meta = 'Y';
  else if (idea.includes('H1') || idea.includes('h1')) entry.h1 = 'Y';
  else if (idea.includes('`title`') || /title page tag/i.test(idea)) entry.title = 'Y';
  else if (idea.includes('`body`') || idea.includes('body tag') || idea.includes('body’s')) entry.body = 'Y';
  groups.set(key, entry);
}

// --- Emit the per-page checklist CSV.
const cols = [
  'url', 'keyword',
  'missing_in_title', 'missing_in_h1', 'missing_in_meta_desc', 'missing_in_body',
  'current_seo_title', 'current_seo_description',
];
stdout.write(cols.join(',') + '\n');
const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
for (const [key, m] of sorted) {
  const [path, kw] = key.split('|');
  const cur = inv[path] ?? { seoTitle: '', seoDescription: '' };
  stdout.write([
    csvEscape(path),
    csvEscape(kw),
    m.title, m.h1, m.meta, m.body,
    csvEscape(cur.seoTitle),
    csvEscape(cur.seoDescription),
  ].join(',') + '\n');
}

stderr.write(`[seo-keyword-audit] ${sorted.length} (url, keyword) tuples\n`);
let nT = 0, nH = 0, nM = 0, nB = 0;
for (const [, m] of sorted) {
  if (m.title) nT++;
  if (m.h1) nH++;
  if (m.meta) nM++;
  if (m.body) nB++;
}
stderr.write(`  title:${nT}  h1:${nH}  meta:${nM}  body:${nB}\n`);
