# Shopify SEO Operations Runbook

Phase 3 of the SEO improvement plan (see `docs/seo-improvement-plan.md`).
These are the data-quality operations that run against the Shopify Admin
API. The code that consumes the data — title metadata, JSON-LD,
sitemap, etc — is already shipped and well-behaved; this runbook is
about making sure the data flowing through it is complete.

## Scripts

All scripts live in `scripts/` and follow the same pattern as
`scripts/pull-inventory.mjs`:

- Read env: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`.
- Dry-run by default. Pass `--apply` (where supported) to mutate.
- Write a timestamped report to `data/seo-backfills/`.

| Script | Purpose | Read/Write | Dry-run? |
|---|---|---|---|
| `seo-backfill-product-seo.mjs` | Fill missing `seo.title` / `seo.description` on products | RW | yes (`--apply` to write) |
| `seo-backfill-skus.mjs` | Generate deterministic SKUs for variants with empty SKU | RW | yes (`--apply` to write) |
| `seo-tag-cleanup-report.mjs` | Audit tag bloat + flag near-duplicate tag groups | R | always read-only |
| `seo-image-alt-report.mjs` | List images missing alt text + suggest replacements | R | always read-only |
| `seo-article-cleanup.mjs` | Surgical Word-cruft cleanup on blog article HTML (parasitic `#:~:text=`, competitor outbound links, empty anchors, `docs-internal-guid` placeholders, tracking params). Idempotent. | RW | yes (`--apply` to write) |

## Required Admin scopes

| Scope | Used by |
|---|---|
| `read_products` | all four scripts |
| `write_products` | `seo-backfill-product-seo.mjs --apply`, `seo-backfill-skus.mjs --apply` |
| `read_content` | `seo-article-cleanup.mjs` (+ `pull-inventory.mjs`) |
| `write_content` | `seo-article-cleanup.mjs --apply` |
| `read_online_store_pages` | `seo-article-cleanup.mjs` (+ `pull-inventory.mjs`) |
| `write_online_store_pages` | `seo-article-cleanup.mjs --apply` |
| `read_themes` | `pull-inventory.mjs` |

Create / edit the Admin app token at: Shopify Admin → Settings → Apps
and sales channels → Develop apps → \[your app\] → Configuration → Admin
API access scopes.

## Operating order

The first time these are run, do them in this order so each step
benefits from the previous:

### 1. Pre-flight (read-only)

```bash
SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
  node scripts/seo-tag-cleanup-report.mjs

SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
  node scripts/seo-image-alt-report.mjs
```

Both produce CSVs under `data/seo-backfills/`. Merchant reviews
manually:

- Tag cleanup CSV: scan the `near_duplicate_groups` column for genuine
  duplicates. Don't auto-remove — some near-duplicates are
  intentional (e.g. `Medium Hybrid Mattresses` vs `Medium Mattresses`
  rank for different intents).
- Image alt CSV: edit `suggested_alt` where the auto-suggestion is
  too generic; replace with a scene-specific alt. Paste approved alts
  into Shopify Admin (Product → Edit images → Add alt text).

### 2. seo.title / seo.description backfill (write)

```bash
# Dry run first — preview the changes
SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
  node scripts/seo-backfill-product-seo.mjs

# Review data/seo-backfills/products-{ts}-dryrun.json. If the proposed
# titles/descriptions look right, run with --apply:

SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
  node scripts/seo-backfill-product-seo.mjs --apply
```

Idempotent — re-runs only touch products whose `seo.title` /
`seo.description` is still empty. Custom merchant-set values are
never overwritten.

### 3. SKU backfill (write)

```bash
SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
  node scripts/seo-backfill-skus.mjs            # dry run

SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
  node scripts/seo-backfill-skus.mjs --apply
```

SKUs are deterministic (`{HANDLE}-{VARIANT-TITLE}` slugified). Real
manufacturer SKUs (when known) should replace these — the script never
overwrites a non-empty SKU.

### 4. Refresh URL inventory (read)

After any mutation pass, re-pull the URL inventory snapshot so the
sitemap and `generateStaticParams` reflect the new state:

```bash
SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
  node scripts/pull-inventory.mjs
```

This is also run daily by the
`.github/workflows/refresh-inventory.yml` GitHub Action, so manual
refreshes are mostly belt-and-braces after a big change.

### 5. Verify

For a sample of edited products:

- View the live PDP and View Source: confirm `<title>` includes the
  new SEO title.
- Open Rich Results Test
  (<https://search.google.com/test/rich-results>): paste the PDP URL,
  confirm `Product` schema reports a non-null `sku` field.
- Submit the updated sitemap in GSC (Search Console → Sitemaps → if
  the lastmod dates changed, GSC will re-fetch automatically).

## Cadence

- **One-shot first pass**: tag cleanup review, image alt review, SEO
  field backfill, SKU backfill. Run once after rolling these scripts
  out.
- **Quarterly**: re-run the read-only audits. New products get added
  weekly; re-running the dry-run reports surfaces drift.
- **On new product imports**: pause the inventory action briefly, run
  the SEO backfill in dry-run, eyeball the proposed titles, then
  `--apply`. Tedious but ensures new SKUs hit the catalog fully
  optimized.

## Rollback

Every script writes a JSON report including the `before` state. To
rollback a specific run:

```bash
# Pseudocode — adapt for the actual report file you want to reverse.
node -e "
  const r = require('./data/seo-backfills/products-2026-05-14....json');
  for (const c of r.changes) {
    // Send a productUpdate with input: { id: c.id, seo: c.before }
  }
"
```

In practice, a dedicated rollback script can be added later if the
mutation passes ever bite. The dry-run-first habit usually avoids
this.

## Why not just do this in Shopify Admin?

The Admin UI's bulk editor supports SKU and tag editing for a few
products at a time, but the catalog is ~200 products × ~5 variants =
~1000 row-level edits. The bulk editor doesn't handle that volume
ergonomically, and there's no "apply template to fields"
functionality. These scripts do template-driven, deterministic,
auditable edits in seconds.
