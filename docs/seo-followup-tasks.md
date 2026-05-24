# SEO Follow-up Tasks (user-actionable)

Everything in this list is **blocked on access or external decisions**
that the code can't do on its own. Tackle in roughly the order shown —
later items depend on earlier ones for measurement / data.

The corresponding code is already shipped on `main`; see
`docs/seo-improvement-plan.md` for the rationale behind each item and
`docs/seo-measurement.md` / `docs/seo-shopify-runbook.md` for the
detailed operating instructions.

---

## 1. Wire measurement (so every later change is attributable)

Estimated effort: **30 minutes total**. Highest priority — every other
SEO change needs this data to prove it worked.

- [x] **Create a GA4 property** at <https://analytics.google.com> for
      `mattressstoreslosangeles.com`. Add a Web Data Stream pointing
      at `https://www.mattressstoreslosangeles.com`. Copy the
      Measurement ID (`G-XXXXXXXXXX`).
- [x] **Verify the site in Google Search Console** at
      <https://search.google.com/search-console> using the HTML-tag
      method. Copy the `content` value out of the tag they show.
- [ ] **(Optional) Verify in Bing Webmaster Tools** at
      <https://www.bing.com/webmasters>. Same flow — copy the
      `content` value from the verification meta tag.
- [x] **Set Vercel env vars** (Project Settings → Environment
      Variables → all 3 environments):
  - [x] `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX`
  - [x] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` = `<value from GSC>`
  - [ ] `NEXT_PUBLIC_BING_SITE_VERIFICATION` = `<value from Bing>` (optional)
- [x] **Redeploy** (Deployments → Redeploy latest, or push any
      commit). Wait ~2 minutes.
- [x] **Verify ownership** in GSC and (if applicable) Bing — they
      should now see the verification meta tag.
- [x] **Submit the sitemap** in GSC: Sitemaps → enter `sitemap.xml`
      → Submit. Expect "Success" within an hour.
- [x] **Link GA4 ↔ GSC**: GSC → Settings → Associations → Google
      Analytics → choose the GA4 property created above. This is the
      only way GA4 surfaces keyword (query) data alongside session /
      conversion data.

See `docs/seo-measurement.md` for failure-mode debugging.

---

## 2. Wire the daily inventory snapshot Action

Estimated effort: **5 minutes**.

- [x] Generate (or reuse) a Shopify Admin API token with scopes
      `read_products`, `read_content`, `read_online_store_pages`,
      `read_themes`.
- [x] In GitHub: repo Settings → Secrets and variables → Actions →
      New repository secret:
  - [x] `SHOPIFY_STORE_DOMAIN` = `la-mattress.myshopify.com`
  - [x] `SHOPIFY_ADMIN_TOKEN` = `shpat_xxxxxxxxxxxxxxxx`
- [x] Actions tab → "Refresh URL inventory snapshot" → Run workflow
      → confirm a green ✓. If `data/url-inventory/` changed, a PR
      opens on branch `chore/refresh-inventory` — review + merge.
- [x] Going forward the workflow auto-runs at 04:00 UTC daily.

---

## 3. Backfill product SEO data (35% of products are missing `seo.title`)

Estimated effort: **45 minutes** (15 min review + 30 min for the
write to land + propagate). Drives ~35% of PDPs to a richer title +
local-intent suffix.

**Two ways to run this** — pick the one that fits:

- **One-click** (recommended): Actions → **"SEO — product seo.title /
  seo.description backfill"** → Run workflow → leave *Apply* unchecked
  for the dry-run, check it to write. The JSON report is uploaded as
  an artifact you can download. Uses the same `SHOPIFY_ADMIN_TOKEN`
  secret as the daily inventory action — no local setup.
- **Local machine** (also fine): with the admin token exported:

```bash
export SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com
export SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx
```

- [x] **Dry-run** the SEO title/description backfill:
      `node scripts/seo-backfill-product-seo.mjs`
- [x] Read `data/seo-backfills/products-{timestamp}-dryrun.json`.
      Spot-check a dozen `after.title` / `after.description` values
      — do they read well? Acceptable to edit the script's
      `generateSeoTitle` / `generateSeoDescription` templates if
      you want a different formula.
- [x] **Apply**: `node scripts/seo-backfill-product-seo.mjs --apply`
      — 69 products updated via MCP (commit `aaa9724`).
- [x] **Dry-run SKU backfill**: `node scripts/seo-backfill-skus.mjs`
- [x] Review `data/seo-backfills/skus-{timestamp}-dryrun.json` — the
      synthetic SKUs are `HANDLE-VARIANT-TITLE` slugified. Replace
      with real manufacturer SKUs if you have them; otherwise
      these unblock the Product JSON-LD `sku` field.
- [x] **Apply**: `node scripts/seo-backfill-skus.mjs --apply` (Phase 285).
- [x] **Tag cleanup audit (read-only)**:
      `node scripts/seo-tag-cleanup-report.mjs` →
      `data/seo-backfills/tag-cleanup-2026-05-14T22-18-37.csv` +
      `tag-cleanup-2026-05-20-mcp-analysis.json`. Bulk-remove pass on
      the obvious duplicates is the only remaining manual step in
      Shopify Admin if/when desired — out of SEO scope until the next
      audit pull.
- [x] **Image alt audit (read-only)**:
      `node scripts/seo-image-alt-report.mjs` →
      `data/seo-backfills/image-alts-{timestamp}.csv`. Audit ran +
      154 product images backfilled (commit `5a68503`).
- [x] After all writes, manually re-run the daily inventory action
      (Actions → "Refresh URL inventory snapshot" → Run workflow)
      so the sitemap reflects the new state.

Full runbook: `docs/seo-shopify-runbook.md`.

---

## 4. Fill in Organization social profiles (1 minute once URLs are confirmed)

The code is ready; just edit `lib/site-config.ts`:

- [ ] Confirm canonical Facebook, Instagram, YouTube, Yelp,
      LinkedIn, X URLs (the ones you actively post from).
- [ ] In `lib/site-config.ts`, uncomment + edit the entries in
      `SOCIAL_PROFILES`. Empty array = `sameAs` is omitted (which
      is correct if a profile doesn't exist — emitting a
      placeholder URL is worse than nothing).
- [ ] Commit + push. Verify on the next deploy that the homepage
      `<script id="ld-organization">` contains the new `sameAs`
      array. Use <https://search.google.com/test/rich-results> to
      check.

---

## 5. Create the 8 LA neighborhood pages in Shopify

Estimated effort: **2 hours** (a few minutes per page if you use the
provided default copy, longer if you want hand-written intros).

The code template is shipped and waiting. Create a Shopify Page
(Online Store → Pages → Add page) for each handle below — the new
`NeighborhoodPage` template renders automatically once the page
exists and is published. If you leave the page body empty, the
default 150–250-word neighborhood-specific blurb from
`lib/neighborhoods.ts` is used; if you author your own body, that
takes precedence.

- [x] `/pages/mattress-store-beverly-hills` (served from West LA + La Brea)
- [x] `/pages/mattress-store-santa-monica` (West LA)
- [x] `/pages/mattress-store-downtown-la` (Koreatown + La Brea)
- [x] `/pages/mattress-store-pasadena` (Glendale)
- [x] `/pages/mattress-store-burbank` (Studio City + Glendale)
- [x] `/pages/mattress-store-sherman-oaks` (Studio City)
- [x] `/pages/mattress-store-hollywood` (La Brea + Koreatown)
- [x] `/pages/mattress-store-long-beach` (West LA + Koreatown)

Set the Shopify Page title to something like
"Mattress Store in {Neighborhood} — LA Mattress" — it's used as the H1.
Optionally fill the SEO title / description in Shopify Admin →
\[Page\] → Search engine listing preview.

After all 8 are published, re-run the inventory refresh Action so
the sitemap picks them up.

**Status 2026-05-20:** ✅ all 8 verified live, published, and in the
inventory snapshot (sitemap-included). Each has the curated 150–250
word blurb from `lib/neighborhoods.ts` in its body. 7 titles matched
the spec; **Beverly Hills** was an outlier (older Page ID `114679021821`
with `"Mattress Store Beverly Hills | Quality Mattresses & Expert
Guidance"`) — title brought in line with the other 7 today via
`pageUpdate` → "Mattress Store in Beverly Hills — LA Mattress".

---

## 6. Refresh on-page copy for 9 near-miss keyword pages

Estimated effort: **3-4 hours**. Each page below ranks on page 1 but
not in the top 3 — small content boosts can move them substantially.
Pure Shopify Admin work (PLP collection descriptions or blog article
bodies); no code changes.

For each: open the URL in Shopify Admin, expand the body content,
target the listed keyword's semantic cluster (related terms, FAQs,
internal links to commercial pages), and bump the lastUpdated date.

- [x] **Homepage** for "mattress stores los angeles" (1,900/mo, #3 → push #1)
      — shipped via PR #266: hero slide #0 body in
      `app/_components/hero-slides.ts` (fallback) now leads with
      "5 mattress stores across Los Angeles — Koreatown, Studio City,
      Glendale, West LA, and La Brea." Effective from 2026-05-27 when
      the Memorial Day metaobject slide expires.
- [ ] **`/pages/shipping-and-delivery`** for "mattress delivery"
      (4,400/mo, #12) — **⚠ handle discrepancy 2026-05-20:** this
      handle does not exist on the store. Actual delivery pages are
      `mattress-store-delivery` **and** `mattress-store-same-day-delivery`
      (two pages = cannibalization risk for this intent). Defer the
      body refresh until the T+30 (2026-06-18) Semrush re-pull
      confirms which page is currently ranking for the 4,400-vol query,
      so this becomes a consolidate-then-enrich (like the full-bed
      cluster) rather than a blind edit of one of two competing pages.
- [x] `/collections/spring-air-mattresses` for "spring air mattress"
      (2,900/mo, #4) — **already done** by merchant: 4 H2 sections
      covering Back Supporter / Tradition / Value Collection / "Where
      to buy Spring Air in Los Angeles" with showroom internal links.
      Verified 2026-05-20.
- [x] `/collections/bed-frames` for "bed frame stores" (1,300/mo, #11)
      — **shipped 2026-05-20:** ~280-word `descriptionHtml` with 3 H2s
      (formats, sizes/brands, delivery+assembly), internal links to
      `/collections/adjustable-beds`, `/collections/mattresses`, and
      `/pages/mattress-store-locations`. Also filled in the previously-
      null `seo.title` ("Bed Frames — Platform, Metal & Adjustable | LA
      Mattress", 56 chars) and `seo.description` (155 chars). Side
      note: 6 of 8 products in this collection are status `DRAFT` —
      that's a merchant inventory decision out of SEO scope.
### Blog refreshes — 5 Word-cruft articles

These 5 §6 blog articles share a Word-exported HTML pattern with real
SEO-harmful issues that compound the underlying content (audit ran
2026-05-20 against the eastern-king article):

- **Parasitic** `<a href="#:~:text=…">` Google Text Fragment anchors
  (23 in the eastern-king article alone)
- **External outbound links to competitor / affiliate domains**
  (sleepfoundation, healthline, nilkamalsleep, naplab, whitelotushome,
  bryte, livingspaces, zomasleep, etc.) bleeding authority — 26 in
  the eastern-king article
- **Empty** `<p><b id="docs-internal-guid-…"></b></p>` placeholder
  paragraphs from the Google Docs export pipeline (~13 each)
- **Empty anchor tags** clustered under H2 headings (~6 each)
- **Self-301 chains** where the article links to a handle that the
  P0 batch (#183) now 301s back to itself (e.g. `king-vs-california-king`)
- **Tracking-param URLs** (`?srsltid=`, `?utm_source=…`) including
  HTML-entity-encoded `&amp;` variants
- **Hardcoded outdated years** ("Best … to Buy in 2025")

A deterministic, idempotent cleanup script is shipped at
`scripts/seo-article-cleanup.mjs`. It applies 8 regex passes that
strip the SEO-harmful wrappers **without touching a single word of the
visible content**, and uses the same SHA-gated protocol that shipped
the 2026-05-19 full-vs-queen enrichment (deterministic build → write
→ re-fetch → SHA-compare → whitespace-normalized fallback for
Shopify's server-side HTML pretty-printer → auto-rollback on real
corruption). The cleanup logic is locally verified to produce a
byte-identical SHA against the eastern-king article, and is provably
idempotent (re-running is a no-op).

**Two ways to run this** — pick the one that fits:

**One-click** (recommended): Actions → **"SEO — blog article cleanup"**
→ Run workflow. Inputs: `apply` (off = dry-run, on = write) and
`handle` (blank = all 5 defaults, or one specific article handle).
The JSON report is uploaded as a downloadable artifact.

- [x] Trigger dry-run with both inputs at defaults (apply=off, handle=blank).
- [x] Download + review the `article-cleanup-{run_id}` artifact.
- [x] Re-trigger with apply=on to write.

**Local machine** (same script, manual):

- [x] **Dry-run** the cleanup against all 5 default articles:
      `node scripts/seo-article-cleanup.mjs`
- [x] Review the report at
      `data/seo-backfills/article-cleanup-{timestamp}-dryrun.json`
      — per-article pass counts, byte deltas, SHAs.
- [x] **Apply** (writes back via `articleUpdate` with SHA verification
      and auto-rollback): `node scripts/seo-article-cleanup.mjs --apply`
      — 4 of 5 written via Shopify MCP (commit `927aaf3`); 5th
      (`how-much-should-you-spend-on-a-mattress`) skipped as 0-match
      no-op. Plus 6 additional promotional articles cleaned in
      follow-up batches (commits `1a38639`, `c143619`).
- [x] Or run a single handle: `node scripts/seo-article-cleanup.mjs --apply <handle>`.

Article-by-article SEO context:

- `what-s-the-difference-between-eastern-king-and-california-king` —
  "eastern king vs california king" 880/mo @ #6. **Highest priority**
  in this batch: just received +382 kw of consolidated signal from
  the P0 batch (3 cluster dupes 301'd into it).
- `englander-mattress-reviews-2024` — "englander mattress" 1,300/mo @ #11.
- `ultimate-sam-s-club-queen-mattress-review-pros-cons-and-top-picks` —
  "sam's club queen mattress" 1,900/mo @ #5–7.
- `sealy-vs-serta-mattress-which-brand-delivers-the-best-sleep` —
  "sealy vs serta" 880/mo @ #11.
- `how-much-should-you-spend-on-a-mattress` — "how much does a mattress
  cost" 4,400/mo (was @ #17 pre-decline, now **lost** from top 100 per
  the 2026-05 lost-keywords pull) — **biggest-volume target** in the batch.

The cleanup is **necessary but not sufficient** — it removes the
authority-bleed wrappers but the underlying content is also dated and
could benefit from a manual editorial refresh (updated stats, FAQ
expansion, internal links to commercial pages). The cleanup is a safe
prerequisite that maximizes the upside of any later editorial work.

---

## 7. Write the 5 new pillar content articles

Estimated effort: **per article: 4–6 hours** (research + draft + edit).
Pure content work, no code. Each article should be 2,000+ words with
hub-and-spoke internal linking from existing related articles.

- [x] **"Best mattress for back pain in 2026"** — shipped as
      `/blogs/beds-mattresses/best-mattress-for-your-bad-back`
      ("Best Mattress for Back Pain: Support, Firmness, and What
      Actually Matters"). Target 5,400/mo.
- [x] **"Where to buy a mattress in Los Angeles"** — shipped as
      `/blogs/mattress-buying-guide/where-to-buy-a-mattress-in-los-angeles`
      ("Where to Buy a Mattress in Los Angeles (2026 Local Guide)").
      Target 3,600/mo.
- [x] **"When is the best time to buy a mattress"** — shipped as
      `/blogs/mattress-buying-guide/best-time-to-buy-a-mattress-in-2024`
      ("Best Time to Buy a Mattress: Every Sale Event Worth
      Knowing"). Target 3,600/mo. Plan to refresh annually.
- [x] **"What is the best mattress" buyer's guide** — shipped as
      `/blogs/mattress-buying-guide/the-best-mattresses-a-comprehensive-guide-to-finding-your-perfect-sl`
      ("How to Choose the Best Mattress: A Practical Buying
      Guide"). Target 4,400/mo.
- [x] **"Best mattress for side sleepers"** — covered by
      `/blogs/.../best-affordable-mattress-for-side-sleepers` +
      `/blogs/.../best-organic-mattresses-for-side-sleepers-in-2024`.
      Target 1,300/mo.

---

## 8. Marketing / off-page (parallel track, 12-month horizon)

These are slow-cooking projects that need outreach + partnerships,
not code. Run continuously.

- [x] **Google Business Profile sweep**: all 5 showrooms have
      canonical `gbpUrl` populated in `lib/showrooms.ts` — `sameAs`
      JSON-LD picks them up automatically. Ongoing photo/review/hour
      maintenance is out of the SEO-doc scope.
- [ ] **Local citation cleanup**: NAP consistency (Name, Address,
      Phone — must match Shopify exactly) on Yelp, Yellow Pages,
      Foursquare, Apple Maps for all 5 showrooms.
- [ ] **Vendor co-marketing**: ask Tempur-Pedic, Sealy, Diamond,
      Spring Air, Englander to list LA Mattress on their dealer-
      finder / where-to-buy pages. These are high-authority
      dofollow links.
- [ ] **Digital PR**: pitch LA local press on a story angle
      (organic mattresses, sleep tips from a 4th-gen mattress
      family). Targets: LA Times, LAist, Hoodline, Time Out LA.
- [ ] **HARO / Qwoted**: have a sleep-expert byline (founder or
      credentialed staff) respond to journalist requests on sleep
      topics. Slow trickle of high-quality links.

---

## 9. Standing operations (monthly / quarterly)

- [ ] **Monthly**: GSC → Performance → Queries — note any pages
      with high impressions + low CTR. Rewrite their `seo.title` in
      Shopify Admin (the headless app picks it up on next ISR
      revalidate, ~10 minutes).
- [ ] **Monthly**: re-run the Semrush site audit (Semrush →
      Projects → mattressstoreslosangeles.com → re-crawl). Compare
      to the 2026-05 baseline at
      `data/seo-audit/mattressstoreslosangeles.com_mega_export_*.csv`.
- [ ] **Quarterly**: re-run all four audit scripts (`seo-tag-cleanup-report.mjs`,
      `seo-image-alt-report.mjs`, plus dry-run the two backfill
      scripts to surface drift on new products).
- [ ] **Quarterly**: refresh the top-traffic blog posts (king sheets
      / cal king, queen vs full XL, air mattress camping) — at
      minimum bump the "Last updated" date and re-publish, ideally
      add 200–400 fresh words.

---

## 9b. Convert Vercel apex → www redirect from 307 to 308 (Vercel dashboard, 2 min)

**Status 2026-05-24:** ✅ done — apex now responds 308 Permanent. Net effect:
the SEMrush 1,134 temp-redirect flag should drop to ~0 (1) on next re-crawl.

The May 15 SEMrush re-audit flagged **1,134 URLs with temporary (302/307)
redirects** — the homepage and every blog index / article URL among
them. Our `next.config.mjs#redirects()` uses `permanent: true` (308) by
default, and `data/url-inventory/redirects.json` has only 1 entry out
of 1094 marked temporary. So the 1,134 temps aren't from the code —
they're from Vercel's domain-level apex → www redirect, which by
default emits **307 (Temporary)** instead of **308 (Permanent)**.

When SEMrush starts a crawl from the apex domain (`mattressstoreslosangeles.com`)
or follows external links pointing at the apex, every page hits one
307 before reaching the www canonical. That's the +1 temp redirect
per URL.

**Fix (Vercel dashboard, ~2 minutes):**

1. Vercel → Project → Settings → **Domains**
2. Find the row for `mattressstoreslosangeles.com` (apex, without www).
3. Click the row, look for the **Redirect** section.
4. Confirm it's set to redirect to `www.mattressstoreslosangeles.com`.
5. Find the **Status code** toggle — it should be **308 (Permanent)**, not 307 (Temporary).
6. If currently 307, click to switch to 308. Save.

**Verification (after the change propagates, ~5 min):**

```bash
curl -sI https://mattressstoreslosangeles.com/ | head -3
```

The response should be `HTTP/2 308`, not `HTTP/2 307`. If still 307,
hard-refresh the Vercel dashboard and verify the toggle saved.

Net SEO impact: the 1,134 temp-redirect flag on the next SEMrush
re-audit drops to ~0 (or to whatever's in `redirects.json` as
`permanent: false`, which is currently 1).

No code change needed — this is purely a CDN/edge config setting.

---

## 10. Deferred technical SEO (track for a future sprint)

These are noted in the plan but intentionally not shipped yet. Each
needs additional data sources or a more careful design.

- [ ] **Review schema on review-style articles** — needs Shopify
      article metafields for "reviewed product handle" + "rating"
      so the emitted Review schema points at a real Product entity.
- [ ] **VideoObject schema** — needs a YouTube oEmbed integration
      (or merchant-entered video metafields) so the schema can carry
      a real video title, thumbnail, and upload date instead of
      proxies from the parent article.
- [ ] **Sitemap split** (`/sitemap-products.xml`,
      `/sitemap-collections.xml`, etc.) — current ~400 URLs is well
      under the 50K limit, and splitting risks breaking the
      `/sitemap.xml` URL already submitted to GSC. Revisit when URL
      count crosses ~30K or when GSC per-section indexation reports
      are wanted for operational reasons.
- [ ] **Brand × size cross-cut sub-nav on PLPs** — needs an
      authoritative mapping of which collections are siblings
      (Shopify's smart-collection rules don't expose this
      structurally). Cleanest path: encode the map in a new
      `lib/collection-siblings.ts` once you've audited which
      cross-cut PLPs are SEO-worthy.

---

## Cowork verification 2026-05-15 — remaining merchant items

Full report: `data/cowork-reports/seo-sprint-review-20260515T083646Z.md`.
11 of 13 findings were code-resolved in Phase 292 and are on
`claude/seo-audit-plan-DuoHW`. Two are blocked on merchant-only data:

- **MEDIUM #10 — GSC / Bing verification meta absent.** ✅ Resolved
  (merchant confirmed 2026-05-15: Google site verification is done).
  The cowork sandbox couldn't read the live HTML (Vercel bot-block 403)
  so it couldn't see the verification token; ownership status is
  authoritative in the GSC dashboard itself, not the page source. Any
  non-meta method (DNS TXT, HTML file, GA, or GSC token) is equally
  valid and renders no meta tag — so "meta absent" is expected, not a
  defect. No code action. (If the meta-tag method is ever preferred,
  set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` /
  `NEXT_PUBLIC_BING_SITE_VERIFICATION` in Vercel and redeploy.)
- **LOW #13 — Organization JSON-LD has no `sameAs`.** ✅ Resolved in
  Phase 293. Merchant-confirmed profiles added to `SOCIAL_PROFILES`
  (`lib/site-config.ts`): Facebook `facebook.com/lamattressstore`,
  Instagram `@lamattressstores`, Yelp
  `los-angeles-mattress-stores-los-angeles` (biz address matches the
  West LA showroom). `sameAs` now emits on the sitewide Organization +
  LocalBusiness JSON-LD on next deploy. **Still open:** the 5 showroom
  Google Business Profile URLs — merchant to provide the canonical
  `g.page` / maps share links; add them to `SOCIAL_PROFILES` (and they
  also feed per-showroom JSON-LD `sameAs`).
- **Post-deploy housekeeping.** After this branch ships, re-submit
  `sitemap.xml` in Google Search Console + Bing Webmaster. The URL is
  unchanged but its contents now resolve to the `www` host with no 308
  hop, so a re-fetch clears any "All URLs are redirects" warning. Allow
  ~3–7 days for GSC and ~14 days for the SEMrush re-crawl deltas, then
  re-run the cowork verification pass.

---

## Quick-reference: where to find things

| What | Where |
|---|---|
| The plan + status table | `docs/seo-improvement-plan.md` |
| GA4 / GSC / Bing operating notes | `docs/seo-measurement.md` |
| Shopify backfill operating notes | `docs/seo-shopify-runbook.md` |
| Existing Semrush export (2026-05 baseline) | `data/seo-audit/` |
| Backfill script reports | `data/seo-backfills/` (created on first run) |
| URL inventory snapshot | `data/url-inventory/` |
| Showroom data | `lib/showrooms.ts` |
| Neighborhood data | `lib/neighborhoods.ts` |
| Social profile URLs (to fill in) | `lib/site-config.ts` (`SOCIAL_PROFILES`) |
| Sitewide JSON-LD builders | `lib/structured-data.ts` |
| GA4 / verification meta wiring | `app/_components/analytics-ga4.tsx`, `app/layout.tsx` |
| FAQ data (homepage + showrooms + 3 CMS pages) | `lib/faq.ts`, `lib/faq-extra.ts` |
| Inventory snapshot refresh Action | `.github/workflows/refresh-inventory.yml` |
