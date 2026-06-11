#!/usr/bin/env node
/**
 * build-redirects-table.mjs — codegen step that converts
 * `data/url-inventory/redirects.json` into `lib/redirects-table.ts`,
 * a compact TS module imported by middleware.ts.
 *
 * Why not import the JSON directly into middleware:
 *   - Vercel's edge build chokes on large JSON imports
 *     (the previous attempt with a 700KB JSON import hung Vercel's
 *     build runner for 25+ minutes at "Creating optimized production
 *     build...", local builds completed in 80s — Vercel-specific
 *     bundling issue).
 *   - A TS module with the data as a packed string literal compiles
 *     ~10x faster than a JSON-import-with-Map-construction because
 *     webpack sees one string, not 2000 AST nodes.
 *
 * Why the table lives in middleware instead of next.config:
 *   - Vercel hard-caps next.config.mjs#redirects() at 1024 entries
 *     per deployment. The legacy + new redirect set is 2000+ entries.
 *   - Middleware has no such cap. Same edge layer — no perf regression.
 *
 * Output format (TSV with header line):
 *   /old-path\t/new-path
 *   /another\t/elsewhere
 *
 * Middleware parses at module-init into a Map<string, string>. O(1)
 * lookup per request.
 *
 * Filters applied at codegen (defensive — same rules as next.config):
 *   - source must start with `/`
 *   - source must not contain `?`, `#`, `:`, `*`, `+`, `(`, `)`,
 *     `[`, `]`, `{`, `}` (path-to-regexp meta-chars; Next.js's
 *     internal redirect validator would reject these too, so we
 *     mirror to keep behavior identical between routing layers)
 *   - skip self-redirects (source === destination)
 *
 * Run automatically via `npm run prebuild`. The output is checked in
 * so production builds don't need the script to run again.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IN = resolve(ROOT, 'data/url-inventory/redirects.json');
const MANUAL = resolve(ROOT, 'data/url-inventory/redirects-manual.json');
const OUT = resolve(ROOT, 'lib/redirects-table.ts');

const PATH_TO_REGEXP_META = /[:*+()\[\]{}]/;
function isValidSource(s) {
  return typeof s === 'string'
    && s.startsWith('/')
    && !s.includes('?')
    && !s.includes('#')
    && !PATH_TO_REGEXP_META.test(s);
}

const raw = readFileSync(IN, 'utf8');
const data = JSON.parse(raw);
const shopifyEntries = Array.isArray(data.redirects) ? data.redirects : [];

// Manual redirects (data/url-inventory/redirects-manual.json) are merged
// in alongside the Shopify export. They exist because pull-inventory.mjs
// rewrites redirects.json wholesale from Shopify Admin, so a redirect
// added only there would vanish on the next sync. Listed FIRST so the
// first-writer-wins dedup below lets a manual entry override a stale
// Shopify entry for the same source. Optional file — absent = no manual
// redirects (don't fail the build).
let manualEntries = [];
try {
  const m = JSON.parse(readFileSync(MANUAL, 'utf8'));
  manualEntries = Array.isArray(m.redirects) ? m.redirects : [];
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
const entries = [...manualEntries, ...shopifyEntries];

let kept = 0;
let droppedShape = 0;
let droppedFormat = 0;
let droppedSelf = 0;
let droppedDup = 0;

// Strip stale `?amp;_fid=` / `?_pos=` tracking params from a destination
// so the redirect lands on the clean canonical URL in one hop. Avoids
// chains where Shopify's stored redirect target carries a session param
// that our middleware then strips with a second 301.
function cleanDest(destination) {
  let dest = destination;
  // Normalize self-referential ABSOLUTE destinations to relative paths.
  // Shopify stores ~900 redirect targets as absolute NON-www URLs
  // (https://mattressstoreslosangeles.com/...). On the canonical www host
  // each of those 301s a SECOND time (non-www → www) — the redirect
  // chains SEMrush flags ("Redirect chains and loops"). Stripping our own
  // origin makes the destination a relative path that resolves on the
  // current host in a single hop. Bonus: a now-relative target that is
  // itself a redirect source becomes matchable, so resolveChain() can
  // flatten chains it previously couldn't see through the absolute URL.
  // Only our own domain is stripped — genuine external targets are left
  // intact.
  dest = dest.replace(/^https?:\/\/(www\.)?mattressstoreslosangeles\.com(?=[/?#]|$)/i, '');
  if (dest === '' || dest.startsWith('?') || dest.startsWith('#')) dest = '/' + dest;
  dest = dest.replace(/[?&]amp;_fid=[^&]*(&|$)/g, (m, tail) => (tail ? '&' : ''));
  dest = dest.replace(/[?&]_fid=[^&]*(&|$)/g, (m, tail) => (tail ? '&' : ''));
  dest = dest.replace(/[?&]_pos=[^&]*(&|$)/g, (m, tail) => (tail ? '&' : ''));
  dest = dest.replace(/[?&]_sid=[^&]*(&|$)/g, (m, tail) => (tail ? '&' : ''));
  dest = dest.replace(/[?&]_ss=[^&]*(&|$)/g, (m, tail) => (tail ? '&' : ''));
  dest = dest.replace(/[?&]srsltid=[^&]*(&|$)/g, (m, tail) => (tail ? '&' : ''));
  // Clean orphan `?` or `?&` left after param stripping
  dest = dest.replace(/\?(&|$)/g, (m, tail) => (tail === '&' ? '?' : ''));
  dest = dest.replace(/\?$/, '');
  return dest;
}

// First pass: build a source → cleaned-destination map of all valid
// entries. Used below to flatten redirect CHAINS (A→B→C) — see
// resolveChain. Last writer wins on duplicate sources, matching the
// Map-build semantics middleware uses at runtime.
const sourceToDest = new Map();
for (const r of entries) {
  if (!r || typeof r.source !== 'string' || typeof r.destination !== 'string') continue;
  if (!isValidSource(r.source)) continue;
  sourceToDest.set(r.source, cleanDest(r.destination));
}

// Flatten a redirect chain to its terminal destination so every emitted
// redirect resolves in a SINGLE hop. SEMrush "Redirect chains and loops"
// flags A→B→C because a crawler hitting A gets two sequential 301s; our
// middleware is single-hop (REDIRECTS.get once), so without flattening
// the chain is served verbatim. Resolving here at codegen keeps the
// runtime untouched and is self-healing for future Shopify exports.
//
// `key` is the chain's own source — excluded from the visited set so a
// 2-cycle (A→B→A) terminates at B rather than looping. The cap (32) and
// self-reference / revisit guards make malformed loops terminate at the
// last good hop instead of hanging the build.
let chainsFlattened = 0;
function resolveChain(source, dest) {
  const visited = new Set([source]);
  let current = dest;
  let hops = 0;
  while (sourceToDest.has(current) && !visited.has(current) && hops < 32) {
    visited.add(current);
    current = sourceToDest.get(current);
    hops += 1;
  }
  if (current !== dest) chainsFlattened += 1;
  return current;
}

const seen = new Set();
const lines = [];
for (const r of entries) {
  if (!r || typeof r.source !== 'string' || typeof r.destination !== 'string') {
    droppedShape += 1;
    continue;
  }
  if (!isValidSource(r.source)) {
    droppedFormat += 1;
    continue;
  }
  const dest = resolveChain(r.source, cleanDest(r.destination));

  if (r.source === dest) {
    droppedSelf += 1;
    continue;
  }
  if (seen.has(r.source)) {
    droppedDup += 1;
    continue;
  }
  seen.add(r.source);
  // Tab separator — neither source nor destination can contain a literal
  // tab (they're URL paths), so unambiguous. No escaping needed.
  if (r.source.includes('\t') || dest.includes('\t')) continue;
  if (r.source.includes('\n') || dest.includes('\n')) continue;
  lines.push(`${r.source}\t${dest}`);
  kept += 1;
}

const PACKED = lines.join('\n');

const ts = `// AUTO-GENERATED by scripts/build-redirects-table.mjs — do not edit by hand.
//
// Source: data/url-inventory/redirects.json (Shopify Admin urlRedirects export)
// Generated: ${new Date().toISOString()}
// Entries:  ${kept} active redirects
//
// Format: tab-separated, one entry per line:
//   source-path\\tdestination-url-or-path
//
// Parsed into a Map<string,string> at middleware module-init for O(1)
// lookup. Tab separator is safe because URL paths cannot contain literal
// tabs.

const PACKED = ${JSON.stringify(PACKED)};

export const REDIRECTS: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  if (!PACKED) return m;
  for (const line of PACKED.split('\\n')) {
    const tab = line.indexOf('\\t');
    if (tab < 0) continue;
    m.set(line.slice(0, tab), line.slice(tab + 1));
  }
  return m;
})();

export const REDIRECTS_COUNT = ${kept};
`;

writeFileSync(OUT, ts, 'utf8');
console.log(`build-redirects-table: wrote ${OUT}`);
console.log(`  kept:     ${kept}`);
console.log(`  dropped (shape):  ${droppedShape}`);
console.log(`  dropped (format): ${droppedFormat}`);
console.log(`  dropped (self):   ${droppedSelf}`);
console.log(`  dropped (dup):    ${droppedDup}`);
console.log(`  chains flattened: ${chainsFlattened}`);
