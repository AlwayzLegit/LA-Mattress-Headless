# Handoff — Diamond Mattress 5-SKU launch

You're picking up a half-finished launch. All the prep is on disk; what's left is pushing through Shopify MCP. Read this whole doc before doing anything.

## Repo state when you start

- Branch: `claude/awesome-euler-5vm5c3` (already pushed, working tree clean as of commit `76a9d94`)
- Working directory: `/home/user/LA-Mattress-Headless`
- Active task: `#25 Launch 5 new Diamond Mattress SKUs` (status: in_progress)
- Other in-progress task: `#23 Ship 4 PDP conversion fixes` — already shipped earlier in the parent session (commit `16c8164`), the task just wasn't marked completed. You can close it.

## The work to finish

Take the 5 product packets in this directory and publish them to Shopify, in the listed order, one at a time, getting the user's sign-off after #1 before continuing to #2.

| Order | Packet | SKU base | MAPP (Queen) | Why this order |
|---|---|---|---|---|
| 1 | `01-independence.json` | DMINHY-11 | $899 | 4th-of-July sale hero — time pressure |
| 2 | `02-dreamstage-arise-luxe-plush.json` | DMALQP-10 | $1,599 | Premium hybrid line |
| 3 | `03-dreamstage-arise-luxe-medium.json` | DMALQM-10 | $1,599 | Same line, medium |
| 4 | `04-dreamstage-arise-luxe-firm.json` | DMALQF-10 | $1,599 | Same line, firm |
| 5 | `05-black-diamond-rockwell.json` | DMRWXF-10 | $2,599 | Top-of-line luxury |

Each JSON packet is **complete**: title, handle, SEO title/meta, all 13 metafields the headless PDP reads (per `lib/shopify/queries/fragments.ts`), 6 size variants with prices + 1.30× compare-at + vendor cost, collection assignments, 400-600 word `description_html`.

Pricing rule (already baked into the packets): **sell = MAPP exactly** (Diamond legal requirement), **compare-at = MAPP × 1.30** (rounded to dollar).

## The blocker the previous session hit

The Shopify MCP call returned "MCP tool call requires approval" and the user couldn't see an approval prompt in their UI. Earlier session was non-interactive enough that the prompt was being suppressed.

**Before you do anything else**: call `mcp__Shopify__get-shop-info` once and confirm it works. If it errors with "requires approval" again, stop and ask the user to approve via their Claude Code session permissions / connector settings before proceeding. Do NOT try to work around it with raw Admin API or env-var tokens — the user explicitly noted Shopify MCP handles its own OAuth and a token-based path is the wrong direction.

## Per-product publishing checklist

For each of the 5 packets, run:

1. **`mcp__Shopify__create-product`** with `title`, `handle`, `vendor`, `productType`, `tags`, `descriptionHtml`, `options`, `variants` (with size, sku, price, compareAtPrice).
2. **Per-variant cost** — the create call may not accept cost; if not, run `productVariantUpdate` GraphQL mutations via `mcp__Shopify__graphql_mutation` to set `inventoryItem.cost` on each variant.
3. **Metafields** — single `metafieldsSet` mutation per product covering all 13 fields. Use the `custom.*` namespace per the packet's `metafields` map. Types:
   - `firmness` / `material_type` / `tagline` → `single_line_text_field`
   - `lede` → `multi_line_text_field`
   - `height_inches` → `number_decimal`
   - `warranty_years` / `trial_nights` / `firmness_score` → `number_integer`
   - `best_for` / `not_ideal_for` → `list.single_line_text_field`
   - `highlights` / `position_fit` / `layers` → `json`
4. **SEO** — set `seo.title` + `seo.description` via `productUpdate` mutation (the create call doesn't take SEO).
5. **Collections** — for each handle in `collections_to_add`, run `mcp__Shopify__add-to-collection`.
6. **Images** — see image strategy below.
7. **Verify publishing channels** — the product MUST be on both **Online Store** AND **Headless** sales channels. The `independence-day-sale` collection bug earlier in this branch's history was a missing-channel publication (was on zero channels → 404). Check via `resourcePublications` and add if needed.
8. **Revalidate** — `POST /api/revalidate` for `/products/<handle>` and each parent collection path. (Or just trust the 5-min ISR.)
9. **Spot-check** — fetch `https://www.mattressstoreslosangeles.com/products/<handle>` (WebFetch will 403 — use `curl` from the user's side or just verify via Shopify Admin).

## Image strategy

The previous session burned cycles trying to scrape Diamond's brand site + retailer mirrors — every storefront is Cloudflare-blocked against WebFetch. **Don't repeat that.**

The right path: pull existing Diamond / Black Diamond product images already on the LA Mattress Shopify shop and reuse them as launch placeholders. The headless PDP renders cleanly with a brand-matching image; we swap to real photography when the vendor sends asset packs.

Procedure:
1. Use `mcp__Shopify__search_products` with `vendor:"Diamond Mattress"` to list existing products.
2. For each new SKU, pick the closest existing product by family (Dreamstage → existing Dreamstage Value Topaz; Black Diamond → existing Azusa Luxury Latex; Anniversary Independence → any Diamond hybrid).
3. Use `mcp__Shopify__get-product` on the matched existing product to read its `media.edges[].node.image.url`.
4. Attach via `productCreateMedia` mutation referencing those CDN URLs.

If you find Diamond imagery already on the shop's CDN that exactly matches these new model names (sometimes the vendor pushes assets ahead of launch), use the exact match. Otherwise the family-closest stand-in.

User explicitly said "no" to emailing the vendor (Michael Hyman, m.hyman@diamondmattress.com) for assets. Don't suggest it.

## Decisions already locked

- **Compare-at multiplier**: 1.30× MAPP. Baked into all 5 packets.
- **4th of July hook**: Independence (`#1`) goes into the hero slot on `/pages/4th-of-july-mattress-sale-2026`. After Independence is live, edit that page's hero metafield to feature the new product handle.
- **Launch cadence**: sequential, one at a time, sign-off after `#1` before continuing.
- **Images**: open-source / web / vendor site (per user); fallback per the image strategy above.

## Constraints to honor

- Stay on branch `claude/awesome-euler-5vm5c3`. Don't push elsewhere.
- Never include the model identifier `claude-opus-4-7` in commits / artifacts.
- Don't open a PR unless the user explicitly asks.
- Don't commit changes without explicit ask.
- After each product is live, mark progress with `TaskUpdate` against task #25 (add subtasks if useful).
- After all 5 are live, mark #25 completed.

## What "done" looks like

- 5 products live on Shopify with status ACTIVE, both channels published, full metafield set, MAPP pricing, 1.30× compare-at, 8+ collections each, real (or family-matched) imagery, valid SEO title/meta.
- 5 PDP URLs return 200 with Product/FAQ/Review JSON-LD intact.
- `/pages/4th-of-july-mattress-sale-2026` hero updated to feature Independence.
- Task #25 marked completed.
- Final reply to user lists the 5 live URLs for spot-check.
