# Image Sourcing Brief: 18 New Products (Tempur-Pedic + Sleep and Beyond)

## 1. Objective

18 products were created in the LA Mattress Shopify store and are live, but
have **zero images**. Source official product imagery for each and return it in
the format in Section 6 so it can be batch-attached to Shopify.

## 2. Why this brief exists

Shopify's image ingestion works server-side: given a public image URL, Shopify
fetches and hosts it itself (this is proven -- Shopify successfully reached the
brand sites, it only needs correct URLs). The blocker is purely **discovery**:
the sourcing environment's web fetch is globally egress-blocked (every site
returns HTTP 403) and search only returns page links, never image-file URLs.

You (cowork) have real browser/download tools and are not so restricted, so the
job is just: **get the real image URLs (or the image files) for each product.**

## 3. What to collect per product

- One primary "hero" image (product on white/neutral background). REQUIRED.
- Up to 3 additional gallery images (angles, lifestyle, detail). Optional.
- Highest resolution available; minimum about 1000px on the long edge.
- Must be the **official brand image** for the **exact** product/model named.
- Watch the near-duplicates. Sleep and Beyond "myMerino Comforter" vs.
  "myComforter" are different products; Tempur "Cloud" vs. "Cloud Adjustable"
  are different products.
- No watermarked third-party/marketplace photos if a brand image exists.

Preferred deliverable is URLs (no download needed). If the image URLs are
publicly GET-able and return image bytes, just return the URLs and Shopify will
fetch them. Downloading/re-hosting is only needed if the URLs are not
durable/public (then return files instead, see Section 6b).

## 4. Sleep and Beyond (8 products)

Fast path (covers all 8 at once): the site is WooCommerce and exposes a public
Store API. Open one of these in a browser and grab the JSON; each product
object has an `images` array with full `src` CDN URLs:

- Primary: [wc/store/v1 products](https://sleepandbeyond.com/wp-json/wc/store/v1/products?per_page=100)
- Fallback: [wc/store products](https://sleepandbeyond.com/wp-json/wc/store/products?per_page=100)
- Discover route: [wp-json index](https://sleepandbeyond.com/wp-json/)

Match each Store-API product to the Shopify products below by name, and pull
its `images[].src`.

Per-product pages (fallback / for gallery shots): open the page, then read the
`og:image` meta tag and the gallery image URLs (they live under
`/wp-content/uploads/...`).

| # | Shopify product GID | Shopify title | Source |
|---|---|---|---|
| 1 | gid://shopify/Product/9280841810173 | Sleep and Beyond myMerino Organic Wool Mattress Topper | [product page](https://sleepandbeyond.com/product/mymerino-topper/) |
| 2 | gid://shopify/Product/9280841842941 | Sleep and Beyond myMerino Organic Wool Pillow | [product page](https://sleepandbeyond.com/product/mymerino-pillow/) |
| 3 | gid://shopify/Product/9280841941245 | Sleep and Beyond myWool Washable Wool Pillow | [product page](https://sleepandbeyond.com/product/mywool-pillow/) |
| 4 | gid://shopify/Product/9280841974013 | Sleep and Beyond myWoolly Adjustable Wool Pillow | Find "myWoolly" pillow via Store API (NOT the "myWoolly Latex Topper") |
| 5 | gid://shopify/Product/9280842006781 | Sleep and Beyond myComforter Washable Wool Comforter | Find "myComforter" via Store API (NOT "myMerino Comforter") |
| 6 | gid://shopify/Product/9280842039549 | Sleep and Beyond myComforter Light Washable Wool Comforter | Find "myComforter Light" via Store API (NOT "myMerino Comforter Light") |
| 7 | gid://shopify/Product/9280842105085 | Sleep and Beyond Organic Cotton Waterproof Mattress Protector | Find organic cotton waterproof mattress protector via Store API |
| 8 | gid://shopify/Product/9280844038397 | Sleep and Beyond Organic Cotton Sateen Sheet Set | Find organic cotton sateen sheet set via Store API |

For rows 4-8 the exact page slug is unconfirmed. The Store API JSON (fast path)
is the reliable way to get the correct image for each; match strictly by name.

## 5. Tempur-Pedic (10 products)

Tempur-Pedic images are on a Scene7/Contentful CDN. Grab the full-size gallery
image URLs (right-click and copy image address, or read `og:image` / the
largest entry in a `<source>` `srcset`).

### 5a. Adjustable bases (4 products)

Category page: [shop-adjustable-bases](https://www.tempurpedic.com/shop-adjustable-bases/)

| Shopify product GID | Shopify title | Find on tempurpedic.com |
|---|---|---|
| gid://shopify/Product/9280767688957 | Tempur-Pedic TEMPUR-Ergo Power Base | "TEMPUR-Ergo Power Base" |
| gid://shopify/Product/9280767754493 | Tempur-Pedic TEMPUR-Ergo Smart Base | "TEMPUR-Ergo Smart Base" |
| gid://shopify/Product/9280767820029 | Tempur-Pedic TEMPUR-Ergo ProSmart Base | "TEMPUR-Ergo ProSmart Base" |
| gid://shopify/Product/9280830996733 | Tempur-Pedic TEMPUR-Ergo Extend Smart Base | "TEMPUR-Ergo Extend Smart Base" |

### 5b. Pillows (6 products)

Category page: [shop-pillows](https://www.tempurpedic.com/shop-pillows/)

| Shopify product GID | Shopify title | Source |
|---|---|---|
| gid://shopify/Product/9280831029501 | Tempur-Pedic TEMPUR-Cloud Pillow | [product page](https://www.tempurpedic.com/shop-pillows/tempur-cloud-essential-pillow/) |
| gid://shopify/Product/9280831062269 | Tempur-Pedic TEMPUR-Cloud Adjustable Pillow | [product page](https://www.tempurpedic.com/shop-pillows/tempur-cloud-adjustable-pillow/) |
| gid://shopify/Product/9280831095037 | Tempur-Pedic TEMPUR-Symphony Pillow | shop-pillows page, find "TEMPUR-Symphony Pillow" |
| gid://shopify/Product/9280831127805 | Tempur-Pedic TEMPUR-Neck Pillow | shop-pillows page, find "TEMPUR-Neck Pillow" |
| gid://shopify/Product/9280831160573 | Tempur-Pedic TEMPUR-Adapt Pro + Cooling Pillow | shop-pillows page, find "TEMPUR-Adapt ProMid + Cooling" |
| gid://shopify/Product/9280831193341 | Tempur-Pedic TEMPUR-Breeze Pro + Advanced Cooling Pillow | shop-pillows page, find "TEMPUR-Breeze Pro + Cooling" |

Note: there is an existing 7th Tempur pillow already imaged
(gid://shopify/Product/7726513094909, "Tempur-Adapt ProMid + Cooling Pillow").
**Ignore it.** It is not in scope.

## 6. Return format

### 6a. Preferred: URL manifest (JSON)

Return exactly this shape. The first URL in each list is the primary/hero
image. Only include URLs that load a real image of the correct product.

```json
[
  {
    "gid": "gid://shopify/Product/9280841810173",
    "title": "Sleep and Beyond myMerino Organic Wool Mattress Topper",
    "images": [
      "https://sleepandbeyond.com/wp-content/uploads/REAL-HERO.jpg",
      "https://sleepandbeyond.com/wp-content/uploads/GALLERY-2.jpg"
    ]
  }
]
```

Cover all 18 GIDs. If a product genuinely has no findable official image,
include it with an empty `images` list and a `note` field explaining why. Do
**not** substitute a wrong or look-alike product image.

### 6b. Alternative: image files

If URLs are not durable/public, download the files and name them
`HANDLE-1.jpg`, `HANDLE-2.jpg`, and so on. Handles correspond to the GIDs
(example handle: `sleep-beyond-mymerino-organic-wool-mattress-topper`, so
`sleep-beyond-mymerino-organic-wool-mattress-topper-1.jpg`). Provide the files
plus a short index mapping handle to GID.

## 7. Quality bar / acceptance

- Correct exact model (double-check the near-duplicates called out above).
- Primary image: clean product shot, at least 1000px, not a thumbnail, not
  watermarked.
- URLs must return an `image/*` content type on a plain GET, with no auth and
  no referer requirement. Otherwise return the file per Section 6b.
- It is better to return fewer, correct images than to guess.

Once this comes back, ingestion into Shopify is a single batched pass
(server-side URL fetch via `productCreateMedia`, or CDN upload for files). No
further input is needed.
