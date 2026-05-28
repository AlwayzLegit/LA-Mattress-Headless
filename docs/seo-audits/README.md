# SEO audits

CSV snapshots of recurring Semrush "Ideas" audits, grouped into per-page
checklists the merchant can act on directly. Each snapshot is generated
by `scripts/seo-keyword-audit.mjs` from a Semrush export and committed
here so the merchant has a versioned record of what was flagged when.

## What's in here

- `keyword-audit-YYYYMMDD.csv` — per `(url, keyword)` rows showing which
  on-page elements (title / H1 / meta description / body) are missing
  the target keyword. Two extra columns at the end carry the current
  `seo.title` and `seo.description` from `data/url-inventory/` so the
  merchant can see what's there now without opening Shopify Admin.

- `backlinks-outreach-YYYYMMDD.csv` — per target-domain rows showing
  outreach priority class (A-publisher / A-directory / A-aggregator /
  B-niche / B-evaluate / C-competitor / C-low-value / D-search /
  D-self / D-noise), with each domain's mention count, the pages on
  our site that should be linked, and the keywords those pages target.

- `backlinks-outreach-YYYYMMDD.md` — companion outreach brief with
  per-tier email templates and a "what NOT to do" section. Read this
  alongside the CSV.

- `semantic-gap-YYYYMMDD.csv` — per `(url, keyword)` rows listing the
  "semantically related words" Semrush says competitors are using
  that this page isn't. Each row carries the missing phrases plus a
  `suggested_action` heuristic (FAQ section / Intro rewrite / Inline
  sentence) based on how many phrases need to be woven in.

The 20260528 keyword snapshot covers 53 `(url, keyword)` tuples — 48
missing in title, 46 in H1, 12 in meta description, 20 in body. The
20260528 backlinks snapshot ranks 328 target domains across 945 ideas
into 10 priority tiers (10 are tier-A — the only ones with both a real
backlink path AND domain authority that moves the needle). The 20260528
semantic-gap snapshot covers 84 `(url, keyword)` gaps — 41 calling for
a FAQ section, 14 for an intro paragraph rewrite, 29 for an inline
sentence addition.

## How to act on a snapshot

1. Open `keyword-audit-<latest>.csv` in Excel / Google Sheets.
2. Filter `missing_in_title = Y` and start there — title is the
   highest-impact element to fix.
3. For each row, edit the page in Shopify Admin:
   - **Collections** → Online Store → Collections → \[Edit] → Search
     engine listing preview.
   - **Pages** → Online Store → Pages → \[Edit] → Search engine
     listing preview.
   - **Blog articles** → Online Store → Blog posts → \[Edit] → Search
     engine listing preview.
4. Append or rephrase the title / meta-description so it contains the
   target keyword. The current values are in the last two columns —
   often just inserting one keyword phrase into the existing copy is
   enough.
5. Re-run a Semrush crawl after a batch of edits to confirm the flags
   drop off.

## How to refresh the snapshot

When a new Semrush export arrives:

```bash
# Keyword-coverage audit (reads CSV, outputs CSV):
# 1. Save the Semrush XLSX as CSV (Excel: File → Save As → CSV)
# 2. Re-run the script — it reads the inventory snapshot for the
#    current-state columns, so refresh that too if it's stale.
node scripts/pull-inventory.mjs                                   # optional refresh
node scripts/seo-keyword-audit.mjs path/to/semrush-export.csv \
  > docs/seo-audits/keyword-audit-YYYYMMDD.csv

# Backlinks outreach (reads XLSX directly via openpyxl):
python3 scripts/seo-backlinks-outreach.py path/to/semrush-export.xlsx \
  > docs/seo-audits/backlinks-outreach-YYYYMMDD.csv

# Semantic-gap audit (reads XLSX directly via openpyxl):
python3 scripts/seo-semantic-gap.py path/to/semrush-export.xlsx \
  > docs/seo-audits/semantic-gap-YYYYMMDD.csv
```

All three scripts write CSV to stdout and a one-line summary to stderr.

## Why these were flagged

Semrush's "Ideas" report tags every page-keyword combination where the
keyword (the target keyword the page is ranked or expected to rank for)
doesn't appear in one of the structured elements Google reads. Missing
in `<title>` is the most-fixable signal — even a small edit there can
materially lift CTR on the SERP. The body-missing flag is the lowest-
impact (Google reads the body but doesn't weight it heavily for the
keyword-match signal — keyword density past a few mentions is just
noise) and merchants can usually ignore it.

## Related code

- `scripts/seo-keyword-audit.mjs` — keyword-audit generator. Reads
  CSV, joins against `data/url-inventory/`, emits the per-page
  checklist CSV.
- `scripts/seo-backlinks-outreach.py` — backlinks-outreach generator.
  Reads XLSX directly via openpyxl, dedupes by target domain,
  classifies each one into a priority tier from a curated dictionary.
  Anything not pre-classified falls into `B-evaluate` so nothing is
  silently dropped — extend the `CLASSIFICATION` dict in the script
  as new domains appear in future exports.
- `scripts/seo-semantic-gap.py` — semantic-gap audit generator. Reads
  XLSX directly via openpyxl, extracts the backtick-wrapped phrases
  Semrush flags as "related words competitors use that you don't,"
  dedupes per (url, keyword), and assigns a heuristic
  `suggested_action` based on how many phrases each page is missing.
- `lib/article-autolink.ts` — closes the sister problem of "no
  internal links in body" by injecting first-mention internal links
  inside article bodies.
- `lib/collection-jsonld.ts` + `lib/page-jsonld.ts` — close the
  AggregateRating side of the Semrush ideas by attaching the sitewide
  Judge.me rating to collection + generic CMS pages via the schema.org
  `mainEntity` → Organization pattern.
