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

- [ ] **Create a GA4 property** at <https://analytics.google.com> for
      `mattressstoreslosangeles.com`. Add a Web Data Stream pointing
      at `https://www.mattressstoreslosangeles.com`. Copy the
      Measurement ID (`G-XXXXXXXXXX`).
- [ ] **Verify the site in Google Search Console** at
      <https://search.google.com/search-console> using the HTML-tag
      method. Copy the `content` value out of the tag they show.
- [ ] **(Optional) Verify in Bing Webmaster Tools** at
      <https://www.bing.com/webmasters>. Same flow — copy the
      `content` value from the verification meta tag.
- [ ] **Set Vercel env vars** (Project Settings → Environment
      Variables → all 3 environments):
  - [ ] `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX`
  - [ ] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` = `<value from GSC>`
  - [ ] `NEXT_PUBLIC_BING_SITE_VERIFICATION` = `<value from Bing>` (optional)
- [ ] **Redeploy** (Deployments → Redeploy latest, or push any
      commit). Wait ~2 minutes.
- [ ] **Verify ownership** in GSC and (if applicable) Bing — they
      should now see the verification meta tag.
- [ ] **Submit the sitemap** in GSC: Sitemaps → enter `sitemap.xml`
      → Submit. Expect "Success" within an hour.
- [ ] **Link GA4 ↔ GSC**: GSC → Settings → Associations → Google
      Analytics → choose the GA4 property created above. This is the
      only way GA4 surfaces keyword (query) data alongside session /
      conversion data.

See `docs/seo-measurement.md` for failure-mode debugging.

---

## 2. Wire the daily inventory snapshot Action

Estimated effort: **5 minutes**.

- [ ] Generate (or reuse) a Shopify Admin API token with scopes
      `read_products`, `read_content`, `read_online_store_pages`,
      `read_themes`.
- [ ] In GitHub: repo Settings → Secrets and variables → Actions →
      New repository secret:
  - [ ] `SHOPIFY_STORE_DOMAIN` = `la-mattress.myshopify.com`
  - [ ] `SHOPIFY_ADMIN_TOKEN` = `shpat_xxxxxxxxxxxxxxxx`
- [ ] Actions tab → "Refresh URL inventory snapshot" → Run workflow
      → confirm a green ✓. If `data/url-inventory/` changed, a PR
      opens on branch `chore/refresh-inventory` — review + merge.
- [ ] Going forward the workflow auto-runs at 04:00 UTC daily.

---

## 3. Backfill product SEO data (35% of products are missing `seo.title`)

Estimated effort: **45 minutes** (15 min review + 30 min for the
write to land + propagate). Drives ~35% of PDPs to a richer title +
local-intent suffix.

From your local machine, with the admin token exported:

```bash
export SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com
export SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx
```

- [ ] **Dry-run** the SEO title/description backfill:
      `node scripts/seo-backfill-product-seo.mjs`
- [ ] Read `data/seo-backfills/products-{timestamp}-dryrun.json`.
      Spot-check a dozen `after.title` / `after.description` values
      — do they read well? Acceptable to edit the script's
      `generateSeoTitle` / `generateSeoDescription` templates if
      you want a different formula.
- [ ] **Apply**: `node scripts/seo-backfill-product-seo.mjs --apply`
- [ ] **Dry-run SKU backfill**: `node scripts/seo-backfill-skus.mjs`
- [ ] Review `data/seo-backfills/skus-{timestamp}-dryrun.json` — the
      synthetic SKUs are `HANDLE-VARIANT-TITLE` slugified. Replace
      with real manufacturer SKUs if you have them; otherwise
      these unblock the Product JSON-LD `sku` field.
- [ ] **Apply**: `node scripts/seo-backfill-skus.mjs --apply`
- [ ] **Tag cleanup audit (read-only)**:
      `node scripts/seo-tag-cleanup-report.mjs` →
      `data/seo-backfills/tag-cleanup-{timestamp}.csv`. Open in a
      spreadsheet, sort by `tag_count` desc; for products with 30+
      tags, scan the `near_duplicate_groups` column and remove
      obvious duplicates in Shopify Admin's bulk editor. Don't
      auto-bulk-remove — some "duplicates" are intentional
      cross-cuts.
- [ ] **Image alt audit (read-only)**:
      `node scripts/seo-image-alt-report.mjs` →
      `data/seo-backfills/image-alts-{timestamp}.csv`. Sort by image
      view count if you have that data; otherwise prioritize the
      top-revenue products. Edit `suggested_alt` where wanted, then
      paste approved alts into Shopify Admin → Product → Edit
      images.
- [ ] After all writes, manually re-run the daily inventory action
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

- [ ] `/pages/mattress-store-beverly-hills` (served from West LA + La Brea)
- [ ] `/pages/mattress-store-santa-monica` (West LA)
- [ ] `/pages/mattress-store-downtown-la` (Koreatown + La Brea)
- [ ] `/pages/mattress-store-pasadena` (Glendale)
- [ ] `/pages/mattress-store-burbank` (Studio City + Glendale)
- [ ] `/pages/mattress-store-sherman-oaks` (Studio City)
- [ ] `/pages/mattress-store-hollywood` (La Brea + Koreatown)
- [ ] `/pages/mattress-store-long-beach` (West LA + Koreatown)

Set the Shopify Page title to something like
"Mattress Store in {Neighborhood} — LA Mattress" — it's used as the H1.
Optionally fill the SEO title / description in Shopify Admin →
\[Page\] → Search engine listing preview.

After all 8 are published, re-run the inventory refresh Action so
the sitemap picks them up.

---

## 6. Refresh on-page copy for 9 near-miss keyword pages

Estimated effort: **3-4 hours**. Each page below ranks on page 1 but
not in the top 3 — small content boosts can move them substantially.
Pure Shopify Admin work (PLP collection descriptions or blog article
bodies); no code changes.

For each: open the URL in Shopify Admin, expand the body content,
target the listed keyword's semantic cluster (related terms, FAQs,
internal links to commercial pages), and bump the lastUpdated date.

- [ ] **Homepage** for "mattress stores los angeles" (1,900/mo, #3 → push #1)
      — add a sub-line under the hero: "Los Angeles mattress stores in
      Koreatown, Studio City, Glendale, West LA & La Brea — free
      white-glove delivery." (Engineering: this is in `hero-slides.tsx`
      / Shopify metaobject — your call which path.)
- [ ] `/pages/shipping-and-delivery` for "mattress delivery" (4,400/mo, #12)
      — body should be ~800 words, include the FAQ section (already
      emitted as schema), link to every PDP that says "free delivery".
- [ ] `/collections/spring-air-mattresses` for "spring air mattress"
      (2,900/mo, #4) — add a 200-word collection description in
      Shopify Admin: target "Spring Air mattress", "Spring Air Back
      Supporter", "where to buy Spring Air in Los Angeles".
- [ ] `/collections/bed-frames` for "bed frame stores" (1,300/mo, #11)
      — same pattern, mention LA showrooms.
- [ ] `/blogs/.../englander-mattress-reviews-2024` — refresh date,
      add FAQ section, internal-link to `/collections/englander-mattresses`.
- [ ] `/blogs/.../ultimate-sam-s-club-queen-mattress-review` — same.
- [ ] `/blogs/.../sealy-vs-serta-mattress` — same.
- [ ] `/blogs/.../what-s-the-difference-between-eastern-king-and-california-king` — same.
- [ ] `/blogs/.../how-much-should-you-spend-on-a-mattress` for
      "how much does a mattress cost" (4,400/mo, #17) — biggest
      single content-refresh opportunity; this page is currently #17
      on a 4,400/mo query.

---

## 7. Write the 5 new pillar content articles

Estimated effort: **per article: 4–6 hours** (research + draft + edit).
Pure content work, no code. Each article should be 2,000+ words with
hub-and-spoke internal linking from existing related articles.

- [ ] **"Best mattress for back pain in 2026"** at
      `/blogs/mattress-buying-guide/best-mattress-for-back-pain`
      — target 5,400/mo. Link out to existing fibromyalgia, SI joint
      pain, scoliosis articles.
- [ ] **"Where to buy a mattress in Los Angeles"** at
      `/blogs/.../where-to-buy-a-mattress-in-los-angeles` — target
      3,600/mo. Heavy local intent; link into all 5 showroom pages
      and the 8 new neighborhood pages.
- [ ] **"When is the best time to buy a mattress"** at
      `/blogs/.../when-to-buy-a-mattress` — target 3,600/mo. Calendar
      guide (Memorial Day, Labor Day, Presidents Day, Black Friday).
      Plan to refresh annually.
- [ ] **"What is the best mattress" buyer's guide** at
      `/blogs/.../how-to-choose-a-mattress` — target 4,400/mo.
      Evergreen, long.
- [ ] **"Best mattress for side sleepers"** at
      `/blogs/.../best-mattress-for-side-sleepers` — target 1,300/mo.

---

## 8. Marketing / off-page (parallel track, 12-month horizon)

These are slow-cooking projects that need outreach + partnerships,
not code. Run continuously.

- [ ] **Google Business Profile sweep**: verify all 5 showrooms
      have current GBP listings with photos, hours, mattress brand
      list, and a process to request reviews after each delivery.
      Once you have the canonical GBP URLs, add them to the
      `gbpUrl` field on each Showroom in `lib/showrooms.ts` (the
      `sameAs` array on per-showroom JSON-LD will pick them up).
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
