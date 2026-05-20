#!/usr/bin/env node
/**
 * seo-backfill-collection-intro-short.mjs — Backfill the
 * `custom.intro_short` collection metafield introduced by RFC v2.1
 * (docs/design/plp-content-layout-v2.md).
 *
 * For every collection where the metafield is empty (or absent), this
 * script proposes a handle-specific 300-600 character intro and — in
 * apply mode — writes it via metafieldsSet on the `custom.intro_short`
 * key.
 *
 * Why handle-specific (stress-test S2):
 *   The runtime fallback `categoryIntroFor()` uses substring-match, so
 *   multiple collections (e.g. all *-tempur-* handles) would share the
 *   exact same paragraph if we just wrote that fallback verbatim. That's
 *   the duplicate-content antipattern Google explicitly flags for
 *   ecommerce category pages. To avoid it, every proposed intro here
 *   combines:
 *     1. A short category-descriptor sentence (from a compact category
 *        cascade — the brand/material/accessory/size dimensions matter)
 *     2. The collection's actual title interpolated into a positioning
 *        sentence
 *     3. A closing signature with showroom + delivery + guarantee detail
 *   This produces a unique paragraph per (category × title) pair.
 *
 * Dry-run by default. Pass --apply to write to Shopify.
 *
 * Output: a JSON report at
 * `data/seo-backfills/collection-intro-short-{timestamp}.json` with
 * one entry per collection showing the proposed value, even in
 * dry-run mode. Merchant can review and optionally edit any proposed
 * value in Shopify Admin AFTER the apply pass.
 *
 * Idempotent: re-running only touches collections whose
 * `custom.intro_short` is currently empty.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-backfill-collection-intro-short.mjs            # dry-run
 *
 *   SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxx \
 *     node scripts/seo-backfill-collection-intro-short.mjs --apply    # write
 *
 * Required Admin scopes: read_products, write_products.
 *
 * The custom.intro_short metafield must already exist (see the audit
 * doc Phase 1, or run scripts/seo-metafields-create-intro-short.mjs if
 * that ships separately). Until it exists, metafieldsSet errors out
 * with `OWNER_TYPE_RESOURCE_TYPE_MISMATCH` — that's the script telling
 * you to land the definition first.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = '2024-10';
const APPLY = process.argv.includes('--apply');

const CHAR_MIN = 300;
const CHAR_MAX = 600;

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN');
  process.exit(1);
}

const ENDPOINT = `https://${STORE}/admin/api/${VERSION}/graphql.json`;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seo-backfills');

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function pullCollections() {
  const Q = `
    query Cs($first: Int!, $after: String) {
      collections(first: $first, after: $after, sortKey: ID) {
        edges { node {
          id handle title
          metafield(namespace: "custom", key: "intro_short") { value }
        } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  const all = [];
  let after;
  let safety = 50;
  while (safety-- > 0) {
    const d = await gql(Q, { first: 50, after });
    all.push(...d.collections.edges.map((e) => e.node));
    if (!d.collections.pageInfo.hasNextPage) break;
    after = d.collections.pageInfo.endCursor;
  }
  return all;
}

// Compact category descriptor — one sentence per dimension. This is
// intentionally shorter than the runtime `categoryIntroFor()` templates
// because we're combining it with title + closing below. Total target
// per proposed intro: 350-500 chars (well inside the 300-600 band).
function categoryDescriptor(handle) {
  const h = handle.toLowerCase();
  // Brand
  if (h.includes('tempur')) {
    return 'Tempur-Pedic builds the original NASA-developed TEMPUR memory foam — all-foam ProAdapt and Adapt, plus hybrid LuxeAdapt models with pocketed coils for a more responsive feel.';
  }
  if (h.includes('stearns') && h.includes('foster')) {
    return 'Stearns & Foster is a hand-tufted luxury innerspring brand (Estate and Reserve collections) built on IntelliCoil pocketed support and cashmere-blend covers, in 14-17 inch heights.';
  }
  if (h.includes('helix')) {
    return 'Helix Sleep makes build-to-fit hybrid mattresses — pocketed coils under foam comfort layers and knit covers, stepping up through the Core, Luxe, and Elite collections.';
  }
  if (h.includes('southerland') || h.includes('scandinavian')) {
    return 'Southerland Scandinavian is a CertiPUR-US-certified natural-latex collection built in Minnesota — latex over pocketed coils, with TENCEL and copper-gel covers, runs cooler than memory foam.';
  }
  if (h.includes('englander')) {
    return 'Englander is a fourth-generation American mattress builder — pocketed coils with gel-infused foam comfort layers in the O’Conner and Allendale luxury innerspring lines.';
  }
  if (h.includes('spring-air')) {
    return 'Spring Air is the original American sleep brand (since 1926) — best known for the Back Supporter line with zoned pocketed coil support and individually wrapped Sensorcoils.';
  }
  if (h.includes('diamond')) {
    return 'Diamond Mattress is a California-built brand (since 1946) — premium handcrafted innersprings and hybrids with copper-cooled and gel memory-foam comfort layers.';
  }
  if (h.includes('restonic')) {
    return 'Restonic is an award-winning American hybrid and innerspring brand — pocketed-coil systems with gel memory foam and latex comfort layers, recognized by Consumer Digest as Best Buy.';
  }
  if (h.includes('eastman') || h.includes('aireloom')) {
    return 'Eastman House / Aireloom are American hand-crafted luxury mattress builders — pocketed coils, natural latex layers, and hand-tufted covers in heights up to 17 inches.';
  }
  // Material
  if (h.includes('memory-foam') || (h.includes('foam') && !h.includes('mattress-foundation'))) {
    return 'Memory foam contours to your body and isolates motion better than any other mattress type — best for side sleepers wanting pressure relief at the shoulders and hips. Gel infusion and copper / open-cell cooling tech offset the trade-off for hot sleepers.';
  }
  if (h.includes('hybrid')) {
    return 'Hybrid mattresses pair memory foam or latex comfort layers with a pocketed-coil base — combining the contouring of foam with the breathability and edge support of an innerspring.';
  }
  if (h.includes('latex')) {
    return 'Latex is the longest-lasting and most breathable mattress material we sell — 15+ year typical life with a buoyant, responsive feel. Best for hot sleepers and shoppers with joint pain.';
  }
  if (h.includes('innerspring')) {
    return 'Innerspring mattresses combine a steel coil support unit with comfort foam, fiber, or pillow-top layers — the traditional mattress construction with the bounce and edge support foam can’t replicate.';
  }
  // Accessory
  if (h.includes('adjustable')) {
    return 'Adjustable bases let you raise the head and feet independently — for reading, eased acid reflux and snoring, and the zero-gravity preset that takes pressure off the lower back. Pairs with most foam, hybrid, and latex mattresses we carry.';
  }
  if (h.includes('pillow')) {
    return 'The right pillow keeps your neck and spine aligned with your mattress — loft should match your sleep position (higher and firmer for side, medium for back, thin for stomach).';
  }
  if (h.includes('foundation') || h.includes('box-spring') || h.includes('boxspring')) {
    return 'A foundation or box spring supports your mattress and protects the warranty — most modern foam, hybrid, and latex mattresses need a solid, slatted, or low-profile foundation.';
  }
  if (h.includes('headboard') || h.includes('frame') || h.includes('bed-frame')) {
    return 'A solid bed frame or headboard finishes the bedroom — platform, metal, and adjustable-compatible designs in every standard size from twin XL to California king.';
  }
  if (h.includes('protect') || h.includes('topper') || h.includes('sheet') || h.includes('bedding')) {
    return 'The right mattress protector, topper, or sheet set extends the life of your mattress and the depth of your sleep — choose by size, material, and care preference.';
  }
  // Sale
  if (h.includes('sale') || h.includes('clearance') || h.includes('floor-model')) {
    return 'Sale and clearance mattresses are deeply discounted — either former showroom display units or last season’s models, all brand new and ship with the same delivery + guarantee as full-price.';
  }
  // Size
  if (h.includes('cal') && h.includes('king')) {
    return 'California king mattresses (72″ × 84″) are the longest standard size we sell — best for taller sleepers, with the same width as a queen-plus.';
  }
  if (h.includes('king')) {
    return 'King mattresses (76″ × 80″) give two adults the most sleeping surface of any standard size — stocked across every material, firmness, and budget.';
  }
  if (h.includes('queen')) {
    return 'Queen mattresses (60″ × 80″) are the most popular size we sell — large enough for two adults, compact enough for most bedrooms.';
  }
  if (h.includes('full') || h.includes('double')) {
    return 'Full / double mattresses (54″ × 75″) suit one adult comfortably with room to stretch, in teen / guest bedrooms or smaller master rooms.';
  }
  if (h.includes('twin-xl') || h.includes('twin-x-l')) {
    return 'Twin XL mattresses (38″ × 80″) suit taller teens, college dorms, and adjustable split-king setups.';
  }
  if (h.includes('twin')) {
    return 'Twin mattresses (38″ × 75″) suit kids’ rooms, bunk beds, daybeds, trundles, and guest rooms.';
  }
  if (h.includes('split')) {
    return 'Split-king setups (two twin XL mattresses on a single king-size frame, ideally a split-head adjustable base) let each partner pick their own firmness and elevation.';
  }
  // Use-case
  if (h.includes('couples')) {
    return 'Mattresses for couples balance motion isolation, edge support, and split-firmness options so two sleepers share a bed without compromising on what either one needs.';
  }
  if (h.includes('back-pain') || h.includes('pressure-relief')) {
    return 'For back pain and pressure relief we recommend medium-firm hybrid or latex builds with zoned pocketed-coil support that keeps the spine neutral while contouring at the shoulders and hips.';
  }
  if (h.includes('cooling')) {
    return 'Cooling mattresses and accessories use latex, gel infusion, copper, phase-change covers, or pocketed coils to dissipate body heat for hot sleepers and warm-climate bedrooms.';
  }
  if (h.includes('organic') || h.includes('natural')) {
    return 'Organic and natural mattresses are built from GOLS-certified latex, GOTS-certified cotton, and wool — no polyurethane foam or chemical flame barriers.';
  }
  if (h.includes('soft') || h.includes('plush')) {
    return 'Soft / plush mattresses cushion side sleepers and shoulders with deeper comfort layers over a supportive base — best for body-weights under ~230 lbs.';
  }
  if (h.includes('medium-firm') || h.includes('medium')) {
    return 'Medium and medium-firm mattresses are the most universally comfortable firmness band — supportive enough for back and stomach sleepers, soft enough for side sleepers.';
  }
  if (h.includes('firm') || h.includes('extra-firm')) {
    return 'Firm and extra-firm mattresses deliver maximum lumbar and edge support — best for back / stomach sleepers, heavier sleepers, and anyone whose previous mattress sagged.';
  }
  if (h.includes('under-1000') || h.includes('under-500') || h.includes('budget')) {
    return 'Budget mattresses on this page are the lowest-priced models we stock with the same delivery and guarantee — typically all-foam or basic-spring builds in standard sizes.';
  }
  // Generic
  return 'Every mattress on this page is on the floor at one of our 5 LA showrooms — Koreatown, West LA, La Brea, Studio City, and Glendale.';
}

function positioningSentence(title) {
  return `Browse ${title} below — try every model in person at LA Mattress Store before you buy.`;
}

function closingSentence(handle) {
  const h = handle.toLowerCase();
  // Variation by category so the closing isn't identical across all 64.
  if (h.includes('pillow') || h.includes('topper') || h.includes('protect') || h.includes('sheet') || h.includes('bedding')) {
    return 'Free delivery in Los Angeles on qualifying orders, and 30-day returns.';
  }
  if (h.includes('foundation') || h.includes('frame') || h.includes('headboard') || h.includes('adjustable')) {
    return 'Free white-glove delivery + assembly in Los Angeles, with haul-away of your old foundation.';
  }
  if (h.includes('sale') || h.includes('clearance')) {
    return 'Same free white-glove delivery and 120-night Love Your Bed Guarantee as full-price mattresses.';
  }
  return 'Free white-glove delivery on orders over $499 in Los Angeles, with our 120-night Love Your Bed Guarantee and 0% APR financing.';
}

function proposeIntro({ handle, title }) {
  const base = `${categoryDescriptor(handle)} ${positioningSentence(title)} ${closingSentence(handle)}`;
  // Collapse stray double spaces.
  let s = base.replace(/\s+/g, ' ').trim();
  if (s.length >= CHAR_MIN && s.length <= CHAR_MAX) return s;
  // Too long: trim at sentence boundary to fit.
  if (s.length > CHAR_MAX) {
    const trimmed = s.slice(0, CHAR_MAX);
    const lastDot = trimmed.lastIndexOf('. ');
    s = lastDot > CHAR_MIN ? trimmed.slice(0, lastDot + 1) : trimmed.trim();
    if (s.length > CHAR_MAX) s = s.slice(0, CHAR_MAX - 3).trimEnd() + '...';
    return s;
  }
  // Too short: pad with a generic LA-context tail.
  const pad = ' Shop in person at any of our 5 LA showrooms — Koreatown, West LA, La Brea, Studio City, and Glendale.';
  let padded = s + pad;
  if (padded.length > CHAR_MAX) padded = padded.slice(0, CHAR_MAX).replace(/\s+\S*$/, '');
  return padded;
}

async function writeIntro({ id, value }) {
  const M = `
    mutation SetIntro($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key }
        userErrors { field message code }
      }
    }`;
  const d = await gql(M, {
    metafields: [
      {
        ownerId: id,
        namespace: 'custom',
        key: 'intro_short',
        type: 'multi_line_text_field',
        value,
      },
    ],
  });
  const errs = d.metafieldsSet.userErrors;
  if (errs.length) throw new Error(`metafieldsSet userErrors: ${JSON.stringify(errs)}`);
}

(async function main() {
  try {
    console.log(`Mode: ${APPLY ? 'APPLY (will mutate Shopify)' : 'dry-run (preview only)'}`);
    console.log(`API: ${VERSION}  store: ${STORE}`);
    const collections = await pullCollections();
    console.log(`Pulled ${collections.length} collections.`);

    const changes = [];
    for (const c of collections) {
      const existing = c.metafield?.value?.trim() ?? '';
      if (existing) continue; // already filled — skip
      const proposed = proposeIntro({ handle: c.handle, title: c.title });
      changes.push({
        id: c.id,
        handle: c.handle,
        title: c.title,
        before: existing || null,
        after: proposed,
        charCount: proposed.length,
      });
    }

    console.log(`Collections needing backfill: ${changes.length}`);
    const lens = changes.map((c) => c.charCount);
    if (lens.length) {
      console.log(`  char-count range: ${Math.min(...lens)} - ${Math.max(...lens)}`);
      console.log(`  out-of-band proposals: ${lens.filter((l) => l < CHAR_MIN || l > CHAR_MAX).length}`);
    }

    // Duplicate-detection: count how many collections share the same proposed intro.
    const dupCount = new Map();
    for (const c of changes) dupCount.set(c.after, (dupCount.get(c.after) ?? 0) + 1);
    const duplicates = [...dupCount.entries()].filter(([, n]) => n > 1);
    console.log(`  unique proposals: ${dupCount.size} / ${changes.length} (${duplicates.length} repeated)`);
    if (duplicates.length) {
      console.log('  WARN: some collections received identical proposed copy:');
      for (const [text, n] of duplicates.slice(0, 5)) {
        console.log(`    (×${n}) ${text.slice(0, 80)}...`);
      }
    }

    await mkdir(OUT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = resolve(OUT_DIR, `collection-intro-short-${ts}${APPLY ? '-applied' : '-dryrun'}.json`);
    await writeFile(
      reportPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), mode: APPLY ? 'apply' : 'dry-run', charMin: CHAR_MIN, charMax: CHAR_MAX, changes }, null, 2),
    );
    console.log(`Wrote report: ${reportPath}`);

    if (!APPLY) {
      console.log('Dry run complete. Re-run with --apply to write the proposed values to Shopify.');
      return;
    }

    let ok = 0;
    let fail = 0;
    for (const c of changes) {
      try {
        await writeIntro({ id: c.id, value: c.after });
        ok += 1;
        if (ok % 10 === 0) console.log(`  applied ${ok}/${changes.length}…`);
      } catch (err) {
        fail += 1;
        console.error(`  FAILED ${c.handle}: ${err.message}`);
      }
    }
    console.log(`Done. ${ok} applied, ${fail} failed.`);
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
})();
