# Image Sourcing Brief — 18 New Products (Tempur-Pedic + Sleep & Beyond)

## Objective
18 products were created in the LA Mattress Shopify store and are live, but have
**zero images**. Source official product imagery for each and return it in the
format in §5 so it can be batch-attached to Shopify.

## Why this brief exists
Shopify's image ingestion works server-side: given a public image URL, Shopify
fetches and hosts it itself (this is proven — Shopify successfully reached the
brand sites, it only needs correct URLs). The blocker is purely **discovery**:
the sourcing environment's web fetch is globally egress-blocked (every site
returns 403) and search only returns page links, never image-file URLs. You
(cowork) have real browser/download tools and are not so restricted, so your job
is just: **get the real image URLs (or the image files) for each product.**

## What to collect per product
- 1 primary "hero" image (product on white/neutral background) — REQUIRED.
- Up to 3 additional gallery images (angles, lifestyle, detail) — nice to have.
- Highest resolution available; minimum ~1000px on the long edge.
- Must be the **official brand image** for the **exact** product/model named.
  Watch the near-duplicates (e.g. Sleep & Beyond "myMerino Comforter" vs
  "myComforter" are different products; Tempur "Cloud" vs "Cloud Adjustable").
- No watermarked third-party/marketplace photos if a brand image exists.

## Preferred deliverable: URLs (no download needed)
If the image URLs are publicly GET-able and return image bytes, **just return
the URLs** — Shopify will fetch them. Downloading/re-hosting is only needed if
the URLs are not durable/public (then return files instead, see §5b).

---

## 1. Sleep & Beyond (8 products) — fastest path first

**Fast path (covers all 8 at once):** the site is WooCommerce and exposes a
public Store API. Open these in a browser and grab the JSON; each product object
has an `images` array with full `src` CDN URLs:

- `https://sleepandbeyond.com/wp-json/wc/store/v1/products?per_page=100`
- (fallback) `https://sleepandbeyond.com/wp-json/wc/store/products?per_page=100`

Match each Store-API product to the Shopify products below by name, and pull its
`images[].src`. If the API path differs, also try `/wp-json/` index to discover
the WooCommerce Store route.

**Per-product pages (fallback / for gallery shots):** grab the `og:image` and
the gallery `<img>`/`data-src` URLs (look under `/wp-content/uploads/...`):

| # | Shopify product GID | Shopify title | Source product page |
|---|---|---|---|
| 1 | gid://shopify/Product/9280841810173 | Sleep & Beyond myMerino® Organic Wool Mattress Topper | https://sleepandbeyond.com/product/mymerino-topper/ |
| 2 | gid://shopify/Product/9280841842941 | Sleep & Beyond myMerino® Organic Wool Pillow | https://sleepandbeyond.com/product/mymerino-pillow/ |
| 3 | gid://shopify/Product/9280841941245 | Sleep & Beyond myWool® Washable Wool Pillow | https://sleepandbeyond.com/product/mywool-pillow/ |
| 4 | gid://shopify/Product/9280841974013 | Sleep & Beyond myWoolly® Adjustable Wool Pillow | https://sleepandbeyond.com/ → find "myWoolly" pillow (slug unconfirmed; not the "myWoolly Latex Topper") |
| 5 | gid://shopify/Product/9280842006781 | Sleep & Beyond myComforter® Washable Wool Comforter | https://sleepandbeyond.com/ → find "myComforter" (washable wool — NOT "myMerino Comforter") |
| 6 | gid://shopify/Product/9280842039549 | Sleep & Beyond myComforter® Light Washable Wool Comforter | https://sleepandbeyond.com/ → find "myComforter Light" (washable wool — NOT "myMerino Comforter Light") |
| 7 | gid://shopify/Product/9280842105085 | Sleep & Beyond Organic Cotton Waterproof Mattress Protector | https://sleepandbeyond.com/ → find organic cotton waterproof mattress protector |
| 8 | gid://shopify/Product/9280844038397 | Sleep & Beyond Organic Cotton Sateen Sheet Set | https://sleepandbeyond.com/ → find organic cotton sateen sheet set |

For rows 4–8 the exact page slug is unconfirmed — the Store API JSON (fast path)
is the reliable way to get the correct image for each; match strictly by name.

---

## 2. Tempur-Pedic adjustable bases (4 products)

Category page: `https://www.tempurpedic.com/shop-adjustable-bases/`
Tempur-Pedic images are on a Scene7/Contentful CDN — grab the full-size gallery
image URLs (right-click → copy image address, or read `og:image` / `<source>`
`srcset` and take the largest).

| Shopify product GID | Shopify title | Find on tempurpedic.com |
|---|---|---|
| gid://shopify/Product/9280767688957 | Tempur-Pedic TEMPUR-Ergo® Power Base | "TEMPUR-Ergo Power Base" |
| gid://shopify/Product/9280767754493 | Tempur-Pedic TEMPUR-Ergo® Smart Base | "TEMPUR-Ergo Smart Base" |
| gid://shopify/Product/9280767820029 | Tempur-Pedic TEMPUR-Ergo® ProSmart® Base | "TEMPUR-Ergo ProSmart Base" |
| gid://shopify/Product/9280830996733 | Tempur-Pedic TEMPUR-Ergo® Extend Smart Base | "TEMPUR-Ergo Extend Smart Base" |

## 3. Tempur-Pedic pillows (6 products)

Category page: `https://www.tempurpedic.com/shop-pillows/`

| Shopify product GID | Shopify title | Known/likely source page |
|---|---|---|
| gid://shopify/Product/9280831029501 | Tempur-Pedic TEMPUR-Cloud® Pillow | https://www.tempurpedic.com/shop-pillows/tempur-cloud-essential-pillow/ |
| gid://shopify/Product/9280831062269 | Tempur-Pedic TEMPUR-Cloud® Adjustable Pillow | https://www.tempurpedic.com/shop-pillows/tempur-cloud-adjustable-pillow/ |
| gid://shopify/Product/9280831095037 | Tempur-Pedic TEMPUR-Symphony® Pillow | shop-pillows/ → "TEMPUR-Symphony Pillow" |
| gid://shopify/Product/9280831127805 | Tempur-Pedic TEMPUR-Neck™ Pillow | shop-pillows/ → "TEMPUR-Neck Pillow" |
| gid://shopify/Product/9280831160573 | Tempur-Pedic TEMPUR-Adapt® Pro + Cooling Pillow | shop-pillows/ → "TEMPUR-Adapt ProMid + Cooling" |
| gid://shopify/Product/9280831193341 | Tempur-Pedic TEMPUR-Breeze® Pro + Advanced Cooling Pillow | shop-pillows/ → "TEMPUR-Breeze Pro + Cooling" |

Note: there is also an existing 7th Tempur pillow already imaged
(`gid://shopify/Product/7726513094909`, "Tempur-Adapt ProMid + Cooling Pillow") —
**ignore it**, it is not in scope.

---

## 5. Return format

### 5a. Preferred — URL manifest (JSON)
Return exactly this shape. First URL in each list = primary/hero image. Only
include URLs that load a real image of the correct product.

```json
[
  {
    "gid": "gid://shopify/Product/9280841810173",
    "title": "Sleep & Beyond myMerino® Organic Wool Mattress Topper",
    "images": [
      "https://sleepandbeyond.com/wp-content/uploads/<real-hero>.jpg",
      "https://sleepandbeyond.com/wp-content/uploads/<gallery-2>.jpg"
    ]
  }
]
```

Cover all 18 GIDs. If a product genuinely has no findable official image, include
it with `"images": []` and a `"note"` explaining why — do **not** substitute a
wrong/look-alike product image.

### 5b. Alternative — image files
If URLs aren't durable/public, download the files and name them
`<shopify-handle>-1.jpg`, `<shopify-handle>-2.jpg`, … (handles are in the tables;
e.g. `sleep-beyond-mymerino-organic-wool-mattress-topper-1.jpg`). Provide the
files plus a short index mapping handle → GID.

## 6. Quality bar / acceptance
- Correct exact model (double-check the near-duplicates called out above).
- Primary image: clean product shot, ≥1000px, not a thumbnail, not watermarked.
- URLs must return `image/*` on a plain GET (no auth, no referer requirement) —
  otherwise return the file per §5b.
- It is better to return fewer, correct images than to guess.

Once this comes back, ingestion into Shopify is a single batched pass (server-side
URL fetch via `productCreateMedia`, or CDN upload for files) — no further input
needed.
