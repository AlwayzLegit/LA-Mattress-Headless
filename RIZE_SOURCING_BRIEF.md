# Sourcing Brief: Missing Rize Home Adjustable Bases

## 1. Objective

Our store carries **12** Rize Home base products (now live). Rize Home's
catalog has more models than we stock. Source the **full product data** for
every Rize adjustable base we are missing, in the format in Section 6, so the
missing models can be batch-created in Shopify and made live the same way the
existing 12 were.

This brief asks for **complete product data** (descriptions, variants, prices,
image URLs), not just images — these are net-new products, not image backfill.

## 2. Why this brief exists

The sourcing environment that produced our catalog is globally egress-blocked:
every outbound request (curl, WebFetch, even our own Shopify CDN) returns HTTP
403. `rizehome.com` cannot be reached from there to diff the catalog or pull
product data. Web search returns page links only, never structured product
data. You (cowork / a browser-capable environment) are not so restricted, so
the job is: **reach rizehome.com, diff against our list, and return full data
for the missing models.**

## 3. Fast path (covers everything at once)

`rizehome.com` is a Shopify store. The collection's products JSON exposes the
complete structured catalog — title, handle, body_html, product_type, vendor,
variants (price + option names + sku), and image `src` URLs:

- Primary: `https://rizehome.com/collections/adjustable-bases/products.json?limit=250`
- Per-product fallback: `https://rizehome.com/products/<handle>.js` (JSON) or
  the product page's `og:image` + gallery `<img>`/`srcset`.
- Also check `https://rizehome.com/collections/adjustable-bases` directly in a
  browser in case any model is excluded from the JSON feed.

Match each Rize product to our list below **by model name**. Anything on Rize
not in our "Already have" list is in scope.

## 4. What we already have (DO NOT re-create these 12)

| Model | Our handle | Our price range |
|---|---|---|
| Deluxe Platform Base | `deluxe-platform-base` | $229–$299 |
| Platform Base | `platform-base` | $159–$249 |
| Rizer Kit | `rizer-kit` | $939–$1,119 |
| EZ Adjustable Base | `ez-adjustable-base` | $1,049–$1,099 |
| Rize Split | `rize-split` | $1,369–$1,577 |
| Plus Adjustable Base | `plus-adjustable-base` | $1,049–$1,349 |
| Aviada Adjustable Base | `aviada-adjustable-base` | $1,949–$2,269 |
| Remedy III Adjustable Base | `remedy-iii-adjustable-base` | $1,497–$2,199 |
| Contemporary IV Adjustable Base | `contemporary-iv-adjustable-base` | $2,098–$4,196 |
| Clarity II Adjustable Base | `clarity-ii-adjustable-base` | $1,299–$1,999 |
| Serenova | `serenova` | $829–$1,069 |
| Restara | `restara-1` | $599–$649 |

## 5. Known-missing models (NOT exhaustive — confirm against the live catalog)

Web search surfaced at least these two Rize models we do **not** carry:

- **Up Adjustable Base** — `rizehome.com/products/up-adjustable-bed`
- **Tranquility II** — head/foot positioning, ~65° range, preset Zero Gravity,
  programmable remote

There may be more (e.g. accessory/parts SKUs, regional or newer models). The
authoritative gap = (every product in Rize's `adjustable-bases` collection)
minus (the 12 in Section 4). Return **all** of them.

## 6. Return format (JSON)

One object per missing product. The first image URL is the hero.

```json
[
  {
    "model": "Up Adjustable Base",
    "rize_handle": "up-adjustable-bed",
    "vendor": "Rize Home",
    "product_type": "Adjustable Base",
    "description_html": "<p>…Rize's body_html, verbatim…</p>",
    "variants": [
      { "option": "Twin XL", "price": "999.00", "sku": "RZ-UP-TXL" },
      { "option": "Queen",   "price": "1099.00", "sku": "RZ-UP-Q" }
    ],
    "images": [
      "https://cdn.shopify.com/s/files/.../up-hero.jpg",
      "https://cdn.shopify.com/s/files/.../up-2.jpg"
    ],
    "truemed_eligible": true
  }
]
```

Notes for whoever fills this:
- `description_html`: copy Rize's `body_html` exactly (we'll sanitize on
  ingest). Do not paraphrase.
- `variants`: one per size/option Rize sells, with that option's price and sku.
- `images`: full-size CDN URLs (the largest in `srcset`), hero first. Plain GET
  must return `image/*` with no auth/referer.
- `truemed_eligible`: true if Rize tags/markets it as Truemed/HSA-eligible
  (most of our adjustable bases carry the `truemed-eligible` tag).
- If a model genuinely can't be sourced, include it with empty `images`/
  `variants` and a `note` explaining why. Do not substitute a look-alike.

## 7. How these get ingested (context — no action needed from sourcer)

Once returned, each product is created in Shopify and brought live to match the
existing 12:

- `vendor: "Rize Home"`, `productType` per Section 6.
- Variants created with the returned prices/options; inventory stocked.
- Images attached server-side from the returned URLs (`productCreateMedia`).
- **Tags:** add `adjustable-base` (so it auto-joins the smart **Adjustable
  Beds & Bases** collection that the nav/footer link to) and `truemed-eligible`
  where applicable. Static platform/foundation bases (non-articulating) must
  **not** get the `adjustable-base` tag.
- Manually added to the **Rize - Adjustable Bases** collection (it's a manual
  collection, no rule).
- `status: ACTIVE`, published to all 9 sales channels (Online Store, Headless,
  La Mattress Store Headless, Hydrogen, LA Mattress Hydrogen, Shop, Google &
  YouTube, Facebook & Instagram, Santa Monica Mattress Store).

## 8. Quality bar / acceptance

- Exact model match; watch near-duplicates (e.g. a base vs. its "II"/"III"
  revision, single vs. split, base vs. parts kit).
- Complete variant + price coverage per model (every size Rize sells).
- Hero image ≥ 1000px, clean product shot, not a thumbnail, not watermarked.
- Better to return fewer, fully-correct products than to guess.
