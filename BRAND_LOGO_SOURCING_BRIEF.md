# Sourcing Brief: Brand Logos

## 1. Objective

The storefront now renders brand logos on the homepage brand strip and the
`/pages/mattress-brands` directory, with a **text-wordmark fallback** when a
logo is missing (so nothing is broken today). Source an official logo for each
brand we carry, host it on our Shopify CDN, and the only code change is one
line per brand in `lib/brand-logos.ts`.

## 2. Why this brief exists

The build environment is globally egress-blocked (curl, WebFetch, even our own
CDN return HTTP 403) and cannot upload files. Logo collection + CDN hosting has
to happen in a browser-capable environment. Once the assets are uploaded, wiring
them in is trivial.

## 3. Brands that need a logo

Keyed by the **brand collection handle** — this exact string is the key in
`lib/brand-logos.ts`. (The live list is derived from `getBrands()`; this is the
current set — include any additional brand the directory shows.)

| Brand | Logo registry key (handle) |
|---|---|
| Tempur-Pedic | `tempur-pedic-mattresses` |
| Stearns & Foster | `stearns-foster-mattresses` |
| Chattam & Wells | `chattam-wells-mattresses` |
| Helix | `helix-mattresses` |
| Diamond | `diamond-mattresses` |
| Spring Air | `spring-air-mattresses` |
| Eastman House | `eastman-house-mattresses` |
| Harvest Green | `harvest-mattresses` |
| Englander | `englander-mattresses` |
| Sleep & Beyond | `sleep-beyond` |

## 4. Asset requirements

- **Official brand logo**, current version, from the brand's press/brand-asset
  page or site header.
- **Transparent background.** SVG strongly preferred; otherwise PNG at ≥ 2×
  display size (logo box renders ~26px tall in the strip, up to ~120px on the
  brands page).
- Trimmed to the mark (no surrounding whitespace), roughly **landscape**
  (horizontal lockup) so it sits evenly in the grid.
- Single-color or full-color is fine — the homepage strip applies a subtle
  grayscale that lifts to full color on hover; the brands page shows it as-is.
- No marketplace/third-party watermarks.

## 5. Hosting + return format

Upload each to the Shopify Files CDN (same bucket as product/showroom imagery,
`cdn.shopify.com/s/files/1/0684/1759/files/...`). Name them
`brand-<handle>.svg` (e.g. `brand-tempur-pedic-mattresses.svg`).

Return a JSON manifest:

```json
[
  {
    "handle": "tempur-pedic-mattresses",
    "src": "https://cdn.shopify.com/s/files/1/0684/1759/files/brand-tempur-pedic-mattresses.svg",
    "width": 240,
    "height": 64
  }
]
```

`width`/`height` = the asset's intrinsic pixel (or viewBox) dimensions —
needed so `next/image` reserves correct layout space.

## 6. Ingestion (context — no action needed from sourcer)

Each manifest entry becomes one line in the `LOGOS` map in
`lib/brand-logos.ts`:

```ts
'tempur-pedic-mattresses': { src: '…', width: 240, height: 64 },
```

No component changes — the brand strip and brands page already prefer the logo
and fall back to the wordmark automatically.

## 7. Quality bar

- Correct, current official logo for the exact brand.
- Transparent, trimmed, crisp at 2×; SVG has no rasterized embedded image.
- Returns `image/svg+xml` or `image/png` on a plain GET, no auth/referer.
- Better to omit a brand (it keeps its clean wordmark) than ship a wrong,
  stretched, or watermarked logo.
