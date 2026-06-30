# Diamond Mattress new-SKU launch — 2026-06-30

Source: Diamond Mattress price list dated 06-18-26, account LOSINC, rep Michael Hyman (m.hyman@diamondmattress.com, 818-679-0633).

Five new SKUs to launch. Each JSON file is a complete product-creation packet: title, handle, SEO tags, full metafield set, variant pricing, collection assignments, and `description_html` body. Publishing happens via Shopify MCP `create-product` once images are confirmed.

## Launch order (sequential — confirmed)

| # | Packet | SKU base | MAPP (Q) | Hook |
|---|---|---|---|---|
| 1 | `01-independence.json` | DMINHY-11 | $899 | 4th-of-July sale-page hero — BIB, ships compressed |
| 2 | `02-dreamstage-arise-luxe-plush.json` | DMALQP-10 | $1,599 | Cooling-copper plush — side sleepers / hot sleepers |
| 3 | `03-dreamstage-arise-luxe-medium.json` | DMALQM-10 | $1,599 | Default-yes medium — couples / combo sleepers |
| 4 | `04-dreamstage-arise-luxe-firm.json` | DMALQF-10 | $1,599 | Back + stomach sleepers |
| 5 | `05-black-diamond-rockwell.json` | DMRWXF-10 | $2,599 | Luxury extra-firm — top-of-line |

## Pricing rule

- **Sell price** = MAPP exactly (legally required by Diamond).
- **Compare-at** = MAPP × 1.30 (rounds to the dollar). Drives the "Save X%" badge on PLP cards.

## Per-product fields included

| Field | Source |
|---|---|
| `title`, `handle` | drafted (keyword-leading) |
| `vendor`, `productType`, `status`, `tags` | drafted |
| `seo.title`, `seo.description` | drafted (≤60 / ≤155 chars) |
| `custom.firmness` / `height_inches` / `material_type` / `warranty_years` / `trial_nights` | from PDF spec |
| `custom.tagline` / `lede` / `best_for` / `not_ideal_for` / `firmness_score` / `position_fit` / `highlights` / `layers` | drafted |
| `options.values` | 6 sizes |
| `variants[]` | size / sku / price / compareAtPrice / cost |
| `collections_to_add[]` | drafted per construction + audience fit |
| `description_html` | 400–600 word body, structured: intro → what's inside → who it's for → sizes → what's included |

## Gating on images

Diamond's brand site (diamondmattress.com) and every retailer mirror returned 403 to WebFetch (Cloudflare bot-block). Three paths forward:

1. **Preferred**: pull image URLs via Shopify MCP `mcp__Shopify__search_products` against the Diamond Mattress shop (the user already authorizes the MCP for our shop); copy the canonical Shopify CDN URLs into each packet. Requires Shopify MCP approval.
2. **Stopgap**: launch with the existing in-store Diamond brand placeholder (we already host one for `cat-hybrid`). PDPs render cleanly; we swap to real photography as it arrives. Acceptable because PLP cards on this storefront degrade gracefully on missing imagery (placeholder + "[Image coming]" label per `app/_components/plp-card.tsx`).
3. **Vendor request**: email Michael Hyman for the marketing asset pack. User declined this option.

Recommend path 1 (MCP-side image discovery) once MCP is approved.

## Publish checklist (per product)

1. `mcp__Shopify__create-product` with the packet's title, handle, vendor, productType, tags, descriptionHtml, options, variants.
2. Set per-variant cost via Shopify GraphQL mutation `productVariantUpdate` (the create call doesn't accept cost).
3. Upload images via `mcp__Shopify__graphql_mutation` → `productCreateMedia` (once URLs available).
4. Populate metafields via `mcp__Shopify__graphql_mutation` → `metafieldsSet` (one batch per product).
5. Add to collections via `mcp__Shopify__add-to-collection` (one call per collection handle).
6. Verify publication channels include **Online Store** and **Headless** (Independence-sale-page bug was a missing publication — don't repeat it).
7. Trigger `POST /api/revalidate` for the new `/products/<handle>` URL + each parent collection.
8. Confirm the PDP renders 200 + carries valid Product / FAQ / Review JSON-LD (the headless app emits these automatically given the metafield set).
9. After ~5 min ISR cycle, submit the PDP URL to GSC URL Inspection.

## Post-launch follow-ups (after all 5 are live)

- **4th-of-July sale page** — wire the Independence handle into the hero slot on `/pages/4th-of-july-mattress-sale-2026`. Highest-priority follow-up because the sale runs.
- **Daily-blog automation** — already targets `/blogs/mattress-buying-guide`; will start indexing new PDPs in next sitemap cycle.
- **Reviews** — Judge.me badge starts empty; first 3 reviews seed the rating.
- **Inventory snapshot** — `scripts/pull-inventory.mjs` picks new products up automatically on its next run; ISR rebuilds within 5 min.
