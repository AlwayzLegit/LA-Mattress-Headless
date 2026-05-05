#!/usr/bin/env node
/**
 * Convert /tmp/redirects-import/redirects.csv (Shopify export format) into
 * data/url-inventory/redirects.json. Tab-separated, header row "Redirect from\tRedirect to".
 *
 * Drops self-redirects (source === destination). Dedupes by source (last write wins —
 * matching how Shopify itself resolves duplicate rules).
 *
 * Run: node scripts/convert-redirects-csv.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = '/tmp/redirects-import/redirects.csv';
const OUT_PATH = resolve(__dirname, '..', 'data/url-inventory/redirects.json');

const csv = readFileSync(CSV_PATH, 'utf8');
const lines = csv.split('\n').filter((l) => l.trim().length > 0);
const [header, ...rows] = lines;
if (!/^Redirect from\tRedirect to$/i.test(header.trim())) {
  console.error('Unexpected CSV header:', header);
  process.exit(1);
}

const seen = new Map();
let selfRedirects = 0;
let invalid = 0;
for (const row of rows) {
  const parts = row.split('\t');
  if (parts.length < 2) { invalid++; continue; }
  const source = parts[0].trim();
  const destination = parts[1].trim();
  if (!source || !destination) { invalid++; continue; }
  if (!source.startsWith('/')) { invalid++; continue; }
  if (source === destination) { selfRedirects++; continue; }
  seen.set(source, destination);
}

const redirects = Array.from(seen.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([source, destination]) => ({
    source,
    destination,
    permanent: true,
  }));

const out = {
  $schema: 'Shopify URL Redirects — paths that must continue to redirect after the migration cutover.',
  $source: 'Shopify Admin → URL Redirects export (CSV), 2026-05-05.',
  $status: 'imported',
  $applicationNote: 'Loaded by next.config.mjs at build time and emitted as Next.js redirects(). Edge-evaluated.',
  $count: redirects.length,
  $importedAt: new Date().toISOString(),
  $importStats: {
    csvRows: rows.length,
    imported: redirects.length,
    selfRedirectsDropped: selfRedirects,
    invalidRowsDropped: invalid,
  },
  redirects,
};

writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${redirects.length} redirects → ${OUT_PATH}`);
console.log(`  csv rows: ${rows.length}, self-redirects: ${selfRedirects}, invalid: ${invalid}`);
