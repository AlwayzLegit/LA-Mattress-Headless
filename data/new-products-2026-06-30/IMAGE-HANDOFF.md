# Handoff — real product photography for the 5 live Diamond Mattress SKUs

You're picking this up in a **local session with real internet access**. The remote/web session that did the launch work is network-policy-restricted (every outbound WebFetch, even to plain Wikipedia, returns 403 — confirmed via proxy status as a policy denial, not per-site bot-blocking) and can't reach diamondmattress.com, retailer mirrors, or image CDNs. That's the only reason this step didn't get finished remotely. Everything else about the launch is done and live.

## Where things stand

All 5 products are **ACTIVE on Shopify**, on all 7 sales channels, with correct pricing, metafields, SEO, and collection membership. The only gap: **all 5 are using family-matched placeholder images pulled from other existing Diamond products on the shop** — not real photography of these specific models. That's what this session is for.

Store: LA Mattress Store (`mattressstoreslosangeles.com`), Shopify Admin via `mcp__Shopify__*` tools (or raw Admin GraphQL if MCP isn't available locally).

| # | Product | Product GID | Handle | Vendor SKU base | Current placeholder media GID |
|---|---|---|---|---|---|
| 1 | Diamond Independence Medium Hybrid Mattress in a Box, 12" | `gid://shopify/Product/9331511886077` | `diamond-anniversary-independence-medium-hybrid-12` | `DMINHY-11` | `gid://shopify/MediaImage/37879835263229` |
| 2 | Diamond Arise Luxe Plush Cooling Hybrid Mattress for Side Sleepers, 15" | `gid://shopify/Product/9331514081533` | `diamond-dreamstage-2-0-arise-luxe-plush-hybrid-15` | `DMALQP-10` | `gid://shopify/MediaImage/37879854727421` |
| 3 | Diamond Arise Luxe Medium Hybrid Mattress for Couples, 15" | `gid://shopify/Product/9331516735741` | `diamond-dreamstage-2-0-arise-luxe-medium-hybrid-15` | `DMALQM-10` | `gid://shopify/MediaImage/37879862132989` |
| 4 | Diamond Arise Luxe Firm Hybrid Mattress for Back Pain, 15" | `gid://shopify/Product/9331516866813` | `diamond-dreamstage-2-0-arise-luxe-firm-hybrid-15` | `DMALQF-10` | `gid://shopify/MediaImage/37879862329597` |
| 5 | Black Diamond Rockwell Luxury Extra Firm Mattress for Heavy Sleepers, 16" | `gid://shopify/Product/9331520176381` | `black-diamond-rockwell-quilted-extra-firm-hybrid-16` | `DMRWXF-10` | `gid://shopify/MediaImage/37879874257149` |

## Important — verify naming before you source photos

A WebSearch (text search worked fine remotely; only page-fetching was blocked) turned up a real concern: **the model names above may not match Diamond's actual current catalog.**

- **"Independence"** — Diamond's real anniversary-edition product is called **"Anniversary Quilted Hybrid"** (Medium/Firm). Nothing found anywhere about a patriotic red/white/blue cover or a model literally named "Independence."
- **"Black Diamond Rockwell... Extra Firm"** — the real Black Diamond line ships in **Plush, Medium, or Firm** (14"), not Extra Firm, and no "Rockwell" name turned up. Diamond's actual extra-firm product is a separate, unrelated line called **"Rock"** (already on this Shopify store).
- **"Dreamstage 2.0 Arise Luxe"** — closest real match is **"Dreamstage Value Luxe"** (same construction: 7-Series foam-encased coils, CertiPUR-US, moisture-wicking cover) — different sub-name.

These live products were built from a previous session's JSON packets sourced from a "Diamond Mattress price list 06-18-26 (rep Michael Hyman, LOSINC)" that may include newer SKUs than what's public — or the packets may have partially invented/blended names. **Before spending time hunting for photos of "Independence" or "Rockwell" specifically, confirm with Diamond (Michael Hyman, m.hyman@diamondmattress.com, 818-679-0633, or the retailer ordering portal at `diamondmattress.com/pages/retailer-ordering-portal`) what these SKUs are actually called** so you're not searching for a product that doesn't exist under that name. You mentioned you're already handling the pricing/naming verification — this is the same question, just relevant to image sourcing too.

## What "done" looks like per product

1. Real photo(s) of the actual model (or, once verified, its real Diamond name/line).
2. Attach via `productCreateMedia` (Admin GraphQL) — Shopify fetches the URL server-side, so it needs to be a real, publicly-reachable HTTPS image URL:
   ```graphql
   mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
     productCreateMedia(productId: $productId, media: $media) {
       media { id status }
       mediaUserErrors { field message code }
     }
   }
   ```
   variables: `{"productId": "<product GID from table above>", "media": [{"originalSource": "<real image URL>", "mediaContentType": "IMAGE", "alt": "<product title>"}]}`
3. Remove the placeholder once the real image is confirmed attached and reordered to be featured (new image becomes featured automatically if it's added first via `productReorderMedia`, or just delete the old one):
   ```graphql
   mutation productDeleteMedia($mediaIds: [ID!]!, $productId: ID!) {
     productDeleteMedia(mediaIds: $mediaIds, productId: $productId) {
       deletedMediaIds
       mediaUserErrors { field message }
     }
   }
   ```
   variables: `{"mediaIds": ["<placeholder media GID from table above>"], "productId": "<product GID>"}`
4. If Diamond sends multiple angles/lifestyle shots, attach all of them — first one attached becomes the featured image unless you set order explicitly via `productReorderMedia`.

## Constraints carried over from the original launch

- Don't invent or AI-generate images and present them as real product photos — these are live, purchasable products; customers should see what they're actually buying.
- Don't use raw Shopify Admin API tokens as a workaround for anything — same as before, MCP handles its own auth.
- Stay on branch `claude/five-diamond-mattress-launch-uu7cv4` if you're also touching this repo (though this task is Shopify-only — no repo changes are required to update product images).
- Once done, a spot-check of each PDP URL (`https://www.mattressstoreslosangeles.com/products/<handle>`) confirms the new image renders. ISR cache is 10 minutes; the Shopify `products/update` webhook (if registered) busts it sooner.

## Not done, only deferred

Everything else from the original launch — pricing, metafields, SEO, collections, channel publishing, and the 4th-of-July sale-page hero — is complete and verified live. This document is scoped to images (and the naming check that blocks doing images well) only.
