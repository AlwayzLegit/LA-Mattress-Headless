# PLP v2.1 + metafields cleanup — merchant decisions checklist

**Status:** Awaiting merchant sign-off. Engineering is blocked on these.
**Date:** 2026-05-20.
**Source docs:** [`plp-content-layout-v2.md`](./plp-content-layout-v2.md) (D1-D9), [`shopify-metafields-metaobjects-audit.md`](./shopify-metafields-metaobjects-audit.md) (C1-C6), [`plp-content-layout-v2-stress-test.md`](./plp-content-layout-v2-stress-test.md) (the pre-implementation stress-test review).
**How to use:** Tick the box and write **yes** / **no** / **amend: …** beside each row. Send back this file. Engineering then implements per your decisions.

---

## Architecture decisions (4)

| | # | Decision | Default | Your call |
|---|---|---|---|---|
| ☐ | **A1** | **Approve the layout swap** — short intro above grid (~55-100 words from a new collection metafield, falling back to a code template for unfilled collections); existing long `descriptionHtml` moves below grid alongside FAQ + helpful pages + buying guides. *Source: RFC §1 D1.* | yes | |
| ☐ | **A2** | **Approve creating `custom.intro_short` collection metafield** with `min:300 max:600` chars validation, `access.storefront=PUBLIC_READ`, pinned. The merchant admin UI will refuse to save anything outside the band, so length consistency is enforced at the platform level rather than via a CI script. *Source: RFC §5.1 + §10 D3 + audit §8 C6.* | yes | |
| ☐ | **A3** | **Length band** for `custom.intro_short`: `min:300 max:600` chars (~55-100 words, industry sweet spot per RFC §4). Or amend to a wider band e.g. `min:200 max:800` chars. *Source: RFC §10 D2.* | 300-600 chars | |
| ☐ | **A4** | **Long-content source-of-truth (F5).** Option B (default, lower risk): keep `collection.descriptionHtml` as the long-content source; delete the unused `custom.seo_content` metafield definition. Option A (purist): script-migrate every collection's `descriptionHtml` into `custom.seo_content`; PLP v2 reads from the metafield with `descriptionHtml` as a transition fallback. Functionally identical to the customer; A is more work for the same UX. *Source: RFC §10 D4 + audit §4 F5 + §8 C2.* | Option B | |

---

## Cleanup decisions (5)

| | # | Decision | Default | Your call |
|---|---|---|---|---|
| ☐ | **B1** | **Approve the pre-flight data audit** (audit Phase 2.5, stress-test B2). Read-only `scripts/seo-metafields-data-audit.mjs` produces a CSV of any (collection, key) pair where one of the 14 to-be-deleted custom.* fields has populated data. Read-only — does not mutate Shopify. **Required** before any deletion runs. *Source: audit §5 Phase 2.5.* | yes | |
| ☐ | **B2** | **Approve Phase 3 deletions** (audit §5) **conditional on B1 CSV review** — up to 14 confirmed-orphan custom.* metafield definitions: `description_`, `link`, `link1`–`link5`, `label`, `label1`–`label5`, singular `sleep_position`. Default "delete definition only" — data on resources persists if recovery is ever needed. *Source: audit §8 C1.* | yes, pending CSV | |
| ☐ | **B3** | **Approve `custom.comfort_level` deletion** (F1 firmness consolidation). Free-text field not queried in headless code; overlaps `custom.firmness`. Confirm no Shopify-side app/process relies on it before deleting. *Source: audit §4 F1 + §8 C3.* | confirm-then-delete | |
| ☐ | **B4** | **Approve adding `choices` validator** to `custom.firmness` with values: `["Soft", "Medium-Soft", "Medium", "Medium-Firm", "Firm", "Extra Firm"]`. Stops free-text drift on this field going forward. *Source: audit §4 F1 + §8 C4.* | yes | |
| ☐ | **B5** | **Approve flipping storefront access to `PUBLIC_READ`** on `custom.sleep_positions` (plural) and, if it survives B3, `custom.comfort_level`. Consistency fix — their siblings (`custom.firmness`, `custom.sleep_disruptors`) already have public storefront access. *Source: audit §4 F7 + §8 C5.* | yes | |

---

## Rollout decisions (3)

| | # | Decision | Default | Your call |
|---|---|---|---|---|
| ☐ | **C1** | **Backfill script for `custom.intro_short`.** Ship `scripts/seo-backfill-collection-intro-short.mjs` (dry-run by default; `--apply` writes) to seed all 64 collections with a handle-specific generated intro at v2 launch, so merchant doesn't have to author 64 intros from scratch. Merchant overrides individually in admin UI afterwards. *Source: RFC §6.3 + §10 D5.* | yes | |
| ☐ | **C2** | **Rollout shape:** preview canary (Vercel preview URL, 1-2 days) → 100% production cutover with 48-72h watch and Vercel instant-rollback safety net. Replaces the earlier 10/50/100 percentage cohort plan (which the stress-test B3 found impossible to deliver with the proposed `NEXT_PUBLIC_*` env var). *Source: RFC §8 (revised) + §10 D6.* | preview → 100% | |
| ☐ | **C3** | **Engineering uses 1-day prototype budget on a Vercel preview deployment** for you to eyeball before the production cutover. Worth doing? *Source: RFC §10 D8.* | yes | |

---

## Implementation decisions (2)

| | # | Decision | Default | Your call |
|---|---|---|---|---|
| ☐ | **D1** | **Bundle cleanup with v2 metafield creation in one PR** (simpler review, fewer merges) vs. split into separate "metafields hygiene" PR. *Source: RFC §10 D9.* | bundle | |
| ☐ | **D2** | **The 5 zero-body collections** (`foundations`, `twin-xl-mattress-sale`, `cooling-pillows`, `headboards`, `split-king-mattresses`) — fine for v2 to render the code template above + FAQ/links below (improvement over today's empty hero), OR you'd rather author Shopify `descriptionHtml` for them first? *Source: RFC §10 D7.* | fine as-is for v2; revisit later | |

---

## Implementation sequence (informational — no decision needed)

After your sign-off above, engineering ships in this order. Each step is reversible.

1. **B1.** Run the read-only data-audit workflow → CSV.
2. **B1+B2.** Merchant reviews CSV. Approve or trim the deletion list.
3. **A2.** Create `custom.intro_short` metafield definition in Shopify.
4. **B2+B3+B4+B5.** Run the cleanup mutations (deletions + validators + storefront access fixes).
5. **A1.** Ship code change on the feature branch — auto-deploys to a Vercel preview URL.
6. **C1.** Run backfill workflow in dry-run mode → review JSON → `--apply` to write.
7. **C3.** Merchant reviews the preview URL.
8. **C2.** Merge PR to `main` → 100% production cutover.
9. 48-72h watch window. Vercel instant-rollback ready if needed.
10. v1 code path removal at next major release (7+ days at stable 100%).

---

## What this checklist replaces

Previously the same decisions lived as **D1-D9** at the bottom of the RFC and **C1-C6** at the bottom of the audit. Same decisions, just consolidated and re-grouped here so you don't have to read both docs to approve. The source rows in the original docs are cross-referenced in each row above for traceability.
