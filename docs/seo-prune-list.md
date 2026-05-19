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
| `mattress-buying-guide/is-a-full-bed-wide-enough-for-two-sleepers` † | 81 | 26 |

† Pre-existing 301 → `full-size-bed-dimensions-width-couples`; the P0
batch flattened that chain so it now 301s **directly** to the hub
(single-hop, cowork-verified 2026-05-19). Reclassified here from the
KEEP table after the de-chain — cowork finding **F1**.

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

---

## 2026-05-19 — `what-is-the-standard-size-of-a-full-bed` resolved (301, no rewrite)

The Cluster-A "⚠ CONSOLIDATE-AFTER-MERGE" item is **closed**. Both
articles were pulled in full from Shopify Admin and read end-to-end:

- **Hub — `full-vs-queen-mattress`** (Article 597477622013, 535 kw):
  a modern, semantically-clean guide — quick-answer, key-takeaways,
  full + queen dimension sections, side-by-side table, room-size +
  weight + bedding subsections, who-should-choose, price, "can two
  adults sleep on a full", an 8-question `<details>` FAQ, clean
  `<h2 id>` anchors (TOC-compatible), internal collection links only.
- **Source — `what-is-the-standard-size-of-a-full-bed`**
  (Article 594346868989, 508 kw): older Word-exported HTML
  (`MsoNormal`, `<!-- [if !supportLists]-->`, broken nested `<div>`s),
  outbound links to **competitor domains** (sleepfoundation,
  nilkamalsleep, zomasleep, livingspaces…), and a product-review
  block whose PDP links carry tracking params (`_pos=…&_fid=…&
  _ss=c&variant=…`) that `robots.txt` + `sanitize.ts` already block.

**Decision: 301 only, no hub rewrite.** Every topic the source covers
(full = double, 54×75, twin-vs-full-vs-queen, room size, two-adults,
budget framing, FAQ) the hub already covers — more accurately, with
better structure, and without the competitor links / param URLs. The
508 kw consolidates to the superior page via the permanent redirect
(now in `redirects.json`). Rewriting the #1 cluster page for a
marginal phrasing gain would risk the flagship for no proportional
benefit — the textbook consolidation here is the redirect, not an
edit. (Status now matches the other Cluster-A rows: a clean 301, not
a special case.)

### Optional polish (not required; safe paste-in if wanted)

The one genuinely net-new angle: the hub frames everything as
*"full vs queen"*, while the source ranked for standalone *"standard
size of a full bed / full bed dimensions in feet & cm / how big is a
full bed"*. If you want to capture that phrasing explicitly on the
canonical URL, paste this block in the Shopify article editor for
`full-vs-queen-mattress` **immediately after the "Full Mattress
Dimensions" section's `Did You Know?` box** (before the
`Queen Mattress Dimensions` heading). It matches the hub's existing
HTML conventions exactly and uses internal links only:

```html
<h2 id="standard-full-bed-size">Standard Full Bed Size: Quick Reference</h2>
<p>If you just need to confirm the <strong>standard size of a full bed</strong>: a full (double) bed is <strong>54 inches wide by 75 inches long</strong> — <strong>4.5 ft × 6.25 ft</strong>, or <strong>137 cm × 190 cm</strong>. Every standard full mattress sold in the U.S. is this size, regardless of brand or construction. "Full" and "double" are the same size — the name doesn't change the measurements.</p>
<div class="comparison-table">
  <table>
    <thead><tr><th>Size</th><th>Dimensions (W × L)</th><th>Best For</th><th>Min. Room Size</th></tr></thead>
    <tbody>
      <tr><td><strong>Twin</strong></td><td>38" × 75" (97 × 190 cm)</td><td>Kids, bunk beds, small rooms</td><td>7 × 10 ft</td></tr>
      <tr><td><strong>Full (Double)</strong></td><td>54" × 75" (137 × 190 cm)</td><td>Solo adults, teens, guest rooms</td><td>10 × 12 ft</td></tr>
      <tr><td><strong>Queen</strong></td><td>60" × 80" (152 × 203 cm)</td><td>Couples, taller sleepers</td><td>10 × 14 ft</td></tr>
    </tbody>
  </table>
</div>
<p>A full is <strong>16 inches wider than a twin</strong> (same 75" length) and <strong>6 inches narrower and 5 inches shorter than a queen</strong>. Plan for ~2 ft of walkway on each open side — a 10 × 12 ft bedroom is the realistic minimum for a full. If you're over 6 ft tall, the 75" length is the full's real limitation; the <a href="/collections/queen-size-mattresses">queen</a> adds 5 inches. Shopping a full now? Browse <a href="/collections/full-size-mattresses">full size mattresses</a> in plush, medium, and firm — every order includes free white glove delivery, setup, and old-mattress removal across Los Angeles.</p>
```

Theme-write blocked via MCP for the live theme, but article-body
writes are *not* blocked — say the word and I'll apply this via
`articleUpdate` (full original body is backed up, so it's one-command
reversible).

---

## 2026-05-19 — cowork verification (post #182/#183): ship-clean

Full report: `data/cowork-reports/seo-recovery-verification-20260519T070513Z.md`.
Production SHA `1b631b15`, Vercel `dpl_BRwJYSV8hogjsHxsmf4zD9asQTw7` READY.

**Verdict: no regressions introduced by #182/#183.** 29/29 redirects
single-hop 308→200, 11/11 noindex correct + sitemap-excluded, sitemap
/ host / robots / schema / internal-link suites all pass, 0 new
first-party Sentry errors.

Two minor findings, both resolved here:

- **F1 (doc):** the Cluster-A KEEP table still listed
  `is-a-full-bed-wide-enough-for-two-sleepers` as KEEP, but the
  implemented decision is a 301 to the hub (the P0 batch flattened its
  pre-existing chain). **Fixed:** row moved to the 301 table above with
  a footnote.
- **F2 (copy):** cowork measured the code-driven `plp-content-intro`
  block (38 words, `lib/plp-content.ts`) against the brief's ~170-word
  expectation. **Clarification:** the ~170-word twin copy *is* live —
  it renders in the prominent `plp-hero-lede` from the Shopify
  `descriptionHtml` (`app/collections/[handle]/page.tsx:175`), a
  *different* element near the H1. The 38-word block is a separate,
  pre-existing supporting paragraph; it was generic, so it's been
  tightened toward the twin / twin-XL near-miss intent. Not a defect.

Semrush T0 capture (cowork suite I) couldn't run — no Semrush surface
in that session. T+30 recovery re-pull due **2026-06-18**.

---

## 2026-05-19 — optional enrichment APPLIED (live)

The "Standard Full Bed Size: Quick Reference" block (the one net-new
angle: standalone *"standard size of a full bed / full bed dimensions
in ft & cm"* phrasing the hub previously only framed as "full vs
queen") is **live on `full-vs-queen-mattress`** (Article 597477622013,
`updatedAt 2026-05-19T07:57:39Z`), inserted between *Full Mattress
Dimensions* and *Queen Mattress Dimensions*.

Applied via `articleUpdate` under a SHA-gated protocol: deterministic
script-built body → local `diff`/SHA proof of the exact payload
(`a2cfde42…`) before any write → post-write re-fetch + SHA compare.
The post-write SHA differed by **+20 bytes**; root-caused by diffing
to **Shopify's server-side HTML pretty-printer** expanding the new
table's compact `<tr><td>` rows to one tag per line. Whitespace-
normalized comparison proved the stored body **semantically identical**
to intent (both 20,348 chars collapsed), all 9 pre-existing section
IDs present exactly once, FAQ/CTA intact — i.e. benign normalization,
not corruption, so **no rollback** (rolling back a correct update over
cosmetic whitespace would have been the wrong call). Original body
backed up at the time; remains one-command reversible if ever wanted.

This closes the last open item from the recovery batch. The 301
consolidation (the dominant lever) was already live + cowork-verified;
this is the incremental on-page polish on the canonical URL.

**Re-verified clean (cowork pass #2, 2026-05-19T08:36:50Z, prod SHA
`0bdae969`):** report
`data/cowork-reports/seo-recovery-verification-2-20260519T083650Z.md`.
Verdicts — *regressions since prior pass: NO*; *enrichment renders
correctly on the flagship: YES*. 0 findings; all 11 suites pass; ISR
already revalidated (`PRERENDER age:0`). The full recovery batch is
verified complete. Only remaining item: the **T+30 (2026-06-18)**
Semrush recovery re-pull.
