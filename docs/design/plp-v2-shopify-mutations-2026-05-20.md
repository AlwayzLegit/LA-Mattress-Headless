# PLP v2.1 Shopify mutations — execution log (2026-05-20)

**Status:** Complete. All operations ran via the Shopify Admin MCP against the live `la-mattress.myshopify.com` store.
**Reversibility:** Every operation is reversible. The 10 deleted definitions can be re-created (or restored from this log's IDs); the 64 written metafields can be cleared by writing an empty value or deleting the metafield itself.
**Companion docs:** [`plp-content-layout-v2.md`](./plp-content-layout-v2.md) (RFC), [`shopify-metafields-metaobjects-audit.md`](./shopify-metafields-metaobjects-audit.md) (audit), [`plp-content-layout-v2-stress-test.md`](./plp-content-layout-v2-stress-test.md) (stress-test).

---

## 1. `custom.intro_short` definition created

```text
metafieldDefinitionCreate → gid://shopify/MetafieldDefinition/191248597245
  namespace: custom
  key: intro_short
  name: "Short intro (above product grid)"
  ownerType: COLLECTION
  type: multi_line_text_field
  validations: [min:300, max:600]
  access.storefront: PUBLIC_READ
  pinned: true (auto-assigned pin position 5 after the deletions in §2)
```

**Verified:** `metafieldsCount` after the §3 backfill: **64** (= all 64 active collections).

---

## 2. Confirmed-empty deletions (10 fields)

Via Phase 2.5 pre-flight CSV (`data/seo-metafields/data-audit-2026-05-20.csv`), these 10 fields had `metafieldsCount: 0` across all 64 collections — verified via `metafieldDefinitions(...) { nodes { metafieldsCount } }` before any deletion ran.

| Old definition ID | namespace.key |
|---|---|
| 2480046333 | custom.link1 |
| 2480079101 | custom.link2 |
| 2480111869 | custom.link3 |
| 2480144637 | custom.link4 |
| 2487025917 | custom.link5 |
| 2491810045 | custom.label1 |
| 2491842813 | custom.label2 |
| 2491875581 | custom.label3 |
| 2491908349 | custom.label4 |
| 2491941117 | custom.label5 |

All 10 mutations executed in a single batch via aliased `metafieldDefinitionDelete`. **0 userErrors**.

---

## 3. `intro_short` backfilled across all 64 collections

Generator: local node run of the templates from `scripts/seo-backfill-collection-intro-short.mjs` against the live collection list. Proposals saved at `data/seo-backfills/collection-intro-short-2026-05-20-dryrun.json`.

**Quality metrics:**

- Char-count range: **312 – 481** (well inside the 300-600 band the validator enforces)
- Out-of-band: 0
- **Unique proposals: 64 / 64** — every collection received a different paragraph (the duplicate-content concern from stress-test S2 is gone)
- Variations per dimension: brand × material × size × use-case × accessory + per-category closing signature

Written via 3 batches of `metafieldsSet` (25 + 25 + 14 = 64 metafields). **0 userErrors**.

---

## 4. State NOT changed (pending merchant decision)

The Phase 2.5 audit found these still hold data the merchant has invested in. **No deletion ran** for any of these:

| Definition | metafieldsCount | Operative decision |
|---|---|---|
| `custom.seo_content` (COLLECTION, rich_text) | 49 | KEEP. Wire via Phase B follow-up RFC (rich-text-JSON → HTML serializer + read path). |
| `custom.description_` (COLLECTION, rich_text, trailing underscore) | 25 | KEEP for now. Merchant decides: merge into `seo_content` or keep + wire. |
| `custom.link` + `custom.label` (singular, COLLECTION) | 1 each | KEEP for now. Merchant confirms whether `queen-size-mattresses` link/label still has a purpose. |
| `custom.sleep_position` (PRODUCT, singular, list) | 4 | KEEP for now. 4 floor-sample products carry light values (`["Side"]`, etc.); merchant approves before deletion. Plural `custom.sleep_positions` is canonical and stays. |
| `custom.firmness` (PRODUCT, single_line_text) | many | KEEP — actively rendered on PDP. Audit F1 recommendation: add `choices` validator (`Soft`, `Medium-Soft`, `Medium`, `Medium-Firm`, `Firm`, `Extra Firm`). Pending merchant approval per decision B4. |
| `custom.comfort_level` (PRODUCT, single_line_text) | unknown — needs read | Suspected orphan per F1, but no deletion until merchant confirms (audit B3). |

---

## 5. Net catalog state after this session

**Before** (this session): 16 COLLECTION `custom.*` definitions (incl. 10 orphans), 0 `intro_short`, ~586KB seo_content / ~26KB description_ at risk under the original deletion plan.

**After:** 6 COLLECTION `custom.*` definitions (10 orphans removed), 1 new `custom.intro_short` definition with 64/64 collections populated (a unique 312-481 char intro each), ~586KB seo_content / ~26KB description_ all preserved.

**Pin positions (post-cleanup):**

| Pin | Key | Count |
|---|---|---|
| 1 | `custom.link` | 1 |
| 2 | `custom.label` | 1 |
| 3 | `custom.description_` | 25 |
| 4 | `custom.heading` | 25 |
| 5 | `custom.intro_short` (new) | 64 |
| (unpinned) | `custom.seo_content` | 49 |

The merchant may want to re-pin so `intro_short` sits above `description_` in the admin UI; that's a 5-second Shopify Admin tweak (Settings → Custom data → Collections → drag-to-reorder pinned section).

---

## 6. What ships next (this PR / branch)

1. **Code change is already on `claude/seo-improvement-plan-wiF00`** — when Vercel auto-deploys the preview URL, every PLP will:
   - Render the new `custom.intro_short` value (or fall back to `categoryIntroFor()` if a future collection has empty intro_short — won't happen for the current 64 since we backfilled all of them).
   - Render the existing `collection.descriptionHtml` below grid (only on the ~25 collections that have it populated).
2. **Phase B (separate follow-up RFC)** will wire `custom.seo_content` as the primary below-grid source via a new rich-text-JSON → HTML serializer. Will unlock the ~586KB of merchant SEO content that's currently sitting in Shopify unused by the headless. Draft design doc coming next.

---

## 7. Mutation IDs (for reversibility / audit trail)

`custom.intro_short` 64 metafield IDs are in `data/seo-backfills/collection-intro-short-2026-05-20-dryrun.json` (in `changes[].id` for the collection ID; the metafield IDs from `metafieldsSet` are in the Shopify Admin and grep-able via the per-collection lookup).
