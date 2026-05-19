# P0 Prune / Redirect List — Cannibalization Recovery

> Generated 2026-05-19 from a live Semrush per-URL pull
> (`domain_organic_unique` filtered per cluster + `domain_organic`
> lost-keywords, US database). Every row has the keyword count (kw) and
> monthly organic traffic (tr) behind the decision. **Nothing here is
> implemented yet — this is for merchant approval.** On approval, 301s
> go into `data/url-inventory/redirects.json` (already wired into
> `next.config.mjs#redirects()`, `lib/sanitize.ts` render-time
> resolution, and `app/sitemap.ts` source-filtering); `noindex,follow`
> entries go into `lib/noindex-articles.ts` (already removes from
> index + sitemap, keeps link equity flowing).

## Decision rule

| Situation | Action | Why |
|---|---|---|
| Duplicate of a clear winner, **≤~15 tr**, real kw footprint | **301 → winner** | Consolidates ranking signal onto the page that already wins the intent |
| Thin programmatic swarm (vehicle-specific, dated "best of {year}" listicles), ~0 tr | **noindex, follow** (or 301 → relevant collection if commercial) | Removes dilution; manipulative to 301 dozens→one editorial page |
| ≥~25 tr **or** distinct sub-intent **or** an active near-miss rank | **KEEP** (often: internal-link to the cluster winner) | Earning traffic or a unique query — pruning would lose money |
| Big page (≥100 kw) with some traffic that still overlaps a winner | **CONSOLIDATE-AFTER-MERGE** (merge copy into winner, *then* 301) | Too much residual value to blind-redirect; needs an editorial pass first |

All actions are fully reversible (delete the redirects.json / noindex
key). `permanent: true` (308) is correct for every 301 below.

---

## Cluster A — Full-size / full-vs-queen sizing

**Winner (keep + expand into the canonical size hub):**
`mattress-buying-guide/full-vs-queen-mattress` — **535 kw, 84 tr**

**Keep, do not touch (distinct intent + real traffic):**

| Article | kw | tr | Note |
|---|---|---|---|
| `mattress-buying-guide/will-a-queen-bed-frame-fit-a-full-size-mattress` | 127 | 201 | ranks #2; compatibility intent |
| `mattress-buying-guide/queen-mattress-vs-full-xl-mattress` | 96 | 195 | full-XL-vs-queen, distinct |
| `mattress-buying-guide/is-a-full-bed-wide-enough-for-two-sleepers` | 81 | 26 | "full bed for couples" — internal-link to winner |

**301 → `mattress-buying-guide/full-vs-queen-mattress`:**

| Source article | kw | tr |
|---|---|---|
| `mattress-buying-guide/how-much-space-does-a-full-size-mattress-really-give-you` | 179 | 0 |
| `mattress-buying-guide/how-many-cubic-feet-is-a-full-sized-mattress` | 32 | 9 |
| `mattress-buying-guide/full-size-bed-dimensions-width-couples` | 33 | 9 |
| `mattress-buying-guide/full-size-bed-dimensions-two-people` | 0 | 0 |
| `mattress-buying-guide/full-size-mattress-dimensions-how-wide-and-long-are-they` | 2 | 0 |
| `mattress-buying-guide/full-size-mattress-measurements-room-layout-tips` | 1 | 0 |
| `mattress-buying-guide/full-vs-queen-mattress-which-one-is-right-for-your-room-and-budget` | 1 | 0 |

**⚠ CONSOLIDATE-AFTER-MERGE (do NOT blind-301):**
`mattress-buying-guide/what-is-the-standard-size-of-a-full-bed` —
**508 kw, 41 tr**. Second-largest hub in this cluster; overlaps the
winner for "how wide is a full bed". Merge its best content into
`full-vs-queen-mattress`, *then* 301. Needs an editorial pass — flag
for merchant, not in the auto batch.

---

## Cluster B — Queen size + "best queen" listicle swarm

**Winners (keep):**
- size queries → `mattress-buying-guide/full-vs-queen-mattress` (535 kw)
- short-queen / RV → `mattress-buying-guide/short-queen-mattresses-for-campers-how-to-measure-and-buy-right` (124 kw, 7 tr)
- affordable → `mattress-buying-guide/best-affordable-queen-mattress` (58 kw, 1 tr) — evergreen "cheap queen mattress"

**301 → `full-vs-queen-mattress` (size-intent dupes):**

| Source | kw | tr |
|---|---|---|
| `mattress-buying-guide/queen-mattress-size-guide-inches-feet-how-to-pick-the-perfect-fit` | 231 | 1 |
| `mattress-buying-guide/queen-vs-california-queen-which-size-fits-your-needs` | 61 | 1 |
| `mattress-buying-guide/what-is-the-size-of-a-queen-mattress` | 39 | 0 |
| `mattress-buying-guide/queen-mattress-cost-2023-price-and-comparison-guide` | 21 | 0 |

**301 → short-queen camper winner:**

| Source | kw | tr |
|---|---|---|
| `mattress-buying-guide/short-queen-vs-standard-queen-mattress-best-choice-for-rvs-and-campers` | 33 | 0 |
| `mattress-buying-guide/short-queen-vs-queen` | 10 | 0 |

**301 → `/collections/queen-size-mattresses` (thin commercial listicles, ~0 tr):**

`best-queen-mattresses-under-500-2025-buyer-s-guide`,
`best-queen-mattresses-under-1000`,
`best-queen-mattresses-of-2025-editor-s-picks-for-every-budget`,
`top-6-best-queen-sized-mattresses-2024`,
`top-rated-queen-mattresses-on-amazon-you-can-order-today`,
`the-ultimate-best-queen-size-mattress-for-guest-rooms-budget-to-luxury-options`,
`best-queen-size-mattress-for-back-pain-relief`,
`best-queen-mattresses-in-studio-city`
(all `mattress-buying-guide/*`, 1–11 kw, 0 tr)

**noindex, follow (pure-comparison thin, ~0 tr):**
`mattress-buying-guide/firm-vs-plush-queen-mattress-how-to-choose-for-your-sleep-style`,
`mattress-buying-guide/memory-foam-vs-hybrid-queen-mattress-which-one-helps-you-sleep-better`,
`mattress-buying-guide/sleep-experts-rate-the-ultimate-queen-memory-foam-mattresses`,
`mattress-buying-guide/top-5-cooling-queen-mattresses-for-hot-sleepers`

---

## Cluster C — Air mattress

**Keep (all distinct intent + real traffic — no cannibalization between them):**
camping-queen (953 tr) · pros-and-cons-long-term (389) ·
can-you-put-...-on-a-bed-frame (60) · can-bed-bugs-live-in-air (27) ·
why-is-...-bulging (26) · how-to-deflate-intex (22) ·
how-to-fold-intex (20) · air-...-popping-noises (16) · cleaning (13) ·
how-to-lift-off-floor (11). Also keep
`full-vs-queen-what-size-air-mattress-fits-in-a-truck-bed` (84 kw, 10)
and `single-vs-full-size-air-mattress-what-s-the-difference` (35 kw, 1)
— internal-link to camping winner instead of pruning.

**noindex, follow (thin vehicle-doorway swarm, ~0 tr):**

| Article | kw | tr |
|---|---|---|
| `mattress-buying-guide/air-mattress-for-subaru-forester` | 5 | 0 |
| `mattress-buying-guide/air-mattress-for-jeep-gladiator` | 2 | 0 |
| `mattress-buying-guide/air-mattress-for-subaru-crosstrek` | 1 | 0 |
| `mattress-buying-guide/how-to-set-up-a-truck-bed-air-mattress-for-camping` | 1 | 0 |
| `mattress-buying-guide/top-air-mattress-options-for-road-trips-and-truck-camping` | 1 | 0 |
| `mattress-buying-guide/best-air-mattress-for-heavyweights` | 10 | 0 |
| `mattress-care-tips/does-temperature-affect-air-mattresses` | 11 | 0 |

---

## Cluster D — California King

**Keep (high traffic / active near-miss — do not touch):**

| Article | kw | tr | Note |
|---|---|---|---|
| `mattress-buying-guide/will-king-sheets-fit-a-california-king-mattress` | 132 | 836 | top blog asset |
| `mattress-buying-guide/do-all-bed-frames-fit-a-california-king-mattress` | 70 | 692 | |
| `mattress-buying-guide/what-s-the-difference-between-eastern-king-and-california-king` | 121 | 41 | **#6 near-miss for "eastern king vs california king" (880/mo)** — push, don't prune |
| `mattress-buying-guide/how-big-is-a-california-king-mattress-in-feet` | 47 | 0 | KEEP as the cal-king-dimensions canonical (it's the best-targeted page for that lost query set) — strengthen + internal-link, do not redirect |

**301 → `mattress-buying-guide/what-s-the-difference-between-eastern-king-and-california-king`:**

| Source | kw | tr |
|---|---|---|
| `mattress-buying-guide/california-king-vs-king-what-s-the-real-difference` | 170 | 1 |
| `mattress-buying-guide/king-vs-california-king` | 168 | 0 |
| `mattress-buying-guide/is-a-california-king-better-than-a-king-for-tall-sleepers` | 44 | 0 |

**301 → `/collections/california-king-mattresses` (thin commercial, ~0 tr):**
`mattress-buying-guide/top-6-best-california-king-mattresses-2024` (8 kw),
`mattress-buying-guide/best-california-king-bedroom-sets-to-buy-online` (16 kw),
`mattress-buying-guide/best-california-king-bed-frames` (4 kw)

---

## New technical finding — `checkout.` subdomain is indexed

Semrush shows the Shopify checkout domain ranking storefront URLs as
duplicates of the headless site, e.g.:

- `checkout.mattressstoreslosangeles.com/collections/futons`
- `checkout.mattressstoreslosangeles.com/blogs/mattress-buying-guide/queen-mattress-box-spring-sets-on-a-budget-best-deals-this-month`
- `checkout.mattressstoreslosangeles.com/products/queen-stearns-foster-lux-estate-cassatt-firm-pillow-top-...`

Same duplicate-host class as the www/apex split (cause #3 in the plan).
This is **Shopify-hosted — not fixable in this repo's code.** Merchant
action: in Shopify, ensure the `checkout.` subdomain is `noindex` /
robots-disallowed for non-checkout paths (or 301s storefront paths to
`www.`). Added to `docs/seo-followup-tasks.md` scope.

---

## Batch summary (on approval)

| Action | Count | Mechanism | Reversible |
|---|---|---|---|
| 301 → cluster winner / collection | ~24 | `redirects.json` (`permanent: true`) | yes |
| `noindex, follow` | ~11 | `lib/noindex-articles.ts` | yes |
| CONSOLIDATE-AFTER-MERGE (merchant editorial first) | 1 | manual + later 301 | yes |
| KEEP + internal-link to winner | ~9 | content (Shopify) | n/a |

Net: ~35 cannibalizing/thin URLs removed from the index, signal
consolidated onto ~6 cluster winners. Expected effect: the lost
6,600 / 4,400-volume size-cluster terms re-enter the SERP on a
**single** canonical URL instead of being split 2–3 ways.

**Scope caveat:** this list covers only the clusters with hard
per-URL Semrush data (full/queen/air/cal-king). A complete sweep of
all 1,133 articles needs the existing audit scripts
(`scripts/seo-tag-cleanup-report.mjs` pattern) + GSC query data — a
follow-on, not a blocker for this batch.
