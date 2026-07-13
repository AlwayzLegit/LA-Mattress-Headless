#!/usr/bin/env node
/**
 * seo-pdp-content-diversify.mjs — Replace the two templated sections of
 * the enriched PDP descriptions with genuinely product-specific copy.
 *
 * SEMrush 2026-07-13, issue 223 "content is not optimized" (errorType 2)
 * flags 36 Diamond + Helix PDPs. Root cause is NOT missing words — a
 * previous enrichment gave every product ~600 words — it's that the
 * "Technology & Construction" and "Who This Mattress Is Best For"
 * sections are word-for-word identical across all 36 products (the
 * Helix variant even carries a template bug: "is a mattress mattress").
 * The brand story, "Why Shop at LA Mattress Store", and "Available
 * Sizes" sections legitimately stay shared; the two middle sections are
 * supposed to be product-specific and aren't.
 *
 * This script swaps exactly those two sections' paragraphs for the
 * per-product copy in COPY below. Every claim in the table derives from
 * the product's own title/tags (construction, firmness, height) or its
 * existing merchant-approved seo fields — no invented specs.
 *
 * Same safety pattern as seo-article-cleanup.mjs: dry-run by default,
 * --apply writes via productUpdate, SHA-verified read-back, rollback on
 * mismatch, JSON report to data/seo-backfills/. A product whose HTML
 * doesn't contain both section headers is SKIPPED and reported (never
 * partially edited).
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=… SHOPIFY_ADMIN_TOKEN=… \
 *     node scripts/seo-pdp-content-diversify.mjs            # dry-run
 *     node scripts/seo-pdp-content-diversify.mjs --apply    # write all
 *     node scripts/seo-pdp-content-diversify.mjs <handle>   # one product
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = '2024-10';
const APPLY = process.argv.includes('--apply');

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN');
  process.exit(1);
}

/**
 * Per-product replacement copy. `construction` replaces the paragraph
 * under "Technology & Construction"; `bestFor` replaces the paragraph
 * under "Who This Mattress Is Best For". Plain sentences, no HTML —
 * the script wraps each in a single <p>.
 */
const COPY = {
  'topaz-diamond-mattress': {
    construction: `The Topaz is the entry point to Diamond's Dreamstage Value Collection: a 7-inch firm innerspring mattress with a smooth tight-top sleep surface and CertiPUR-US certified comfort foam over a supportive coil core, handcrafted in Diamond's Southern California factory. The low 7-inch profile makes it a natural fit for bunk beds, daybeds, trundles, and platform frames where a full-height mattress sits too tall.`,
    bestFor: `Pick the Topaz for kids' rooms, guest rooms, and rental units that need a solid firm mattress at a Queen-from-$399 price, or anywhere a slim profile matters. The firm tight-top surface suits back and stomach sleepers who want flat, even support without pillowy sink.`,
  },
  'rock-extra-firm-mattress-diamond-mattress': {
    construction: `The Rock is Diamond's firmest build: a 12-inch extra firm mattress pairing Diamond's own in-house pocketed coil system with dense CertiPUR-US certified support foams and a reinforced tight-top surface — no plush quilting to soften the response. Diamond makes its coils, foams, and fabrics under one roof in Southern California, and the Rock uses that control to push firmness to the top of the range.`,
    bestFor: `If every mattress you try feels too soft, the Rock is the answer: strict back and stomach sleepers, sleepers over 230 lbs who need maximum pushback, and anyone whose physical therapist recommended the firmest practical surface. An extra firm mattress like this also pairs well with a separate topper for sleepers who want tunable comfort over rock-solid support.`,
  },
  'progel-8-memory-diamond-mattress': {
    construction: `The ProGel 8" is a streamlined all-foam build: an 8-inch gel memory foam mattress with a cooling gel-infused comfort layer over Diamond's high-density CertiPUR-US certified base foam. The slim profile keeps the firm side of the ProGel line's feel — less foam depth means you sleep closer to the supportive core.`,
    bestFor: `A firm gel memory foam mattress at this height is a strong pick for platform beds, adjustable bases, kids and teens, and back or stomach sleepers who like foam's motion isolation but not deep sink. The gel infusion pulls heat away from the surface, addressing the classic memory-foam warmth complaint.`,
  },
  '10-gel-memory-diamond-mattress': {
    construction: `The ProGel 10" builds on Diamond's gel memory foam platform with a thicker comfort section: a 10-inch medium gel memory foam mattress layering gel-infused memory foam over progressively firmer CertiPUR-US certified support foams, all processed in Diamond's own Southern California facility.`,
    bestFor: `The medium feel with an extra inch of comfort foam over the 8" model suits side and combination sleepers who want contouring pressure relief at the shoulders and hips with cool-touch gel rather than heat-trapping traditional memory foam. It's also a popular adjustable-base pairing — all-foam builds flex cleanly with the base.`,
  },
  'plush-lucille-luxury-natural-latex-diamond-mattress': {
    construction: `The Lucille Plush tops Diamond's natural latex program: a luxury euro top mattress layering breathable natural latex over Diamond's in-house pocketed coils, with the plush euro top adding a deep, cushioned crown that's sewn beneath the cover rather than pillowed on top. Natural latex is inherently buoyant and sleeps cooler than synthetic foams.`,
    bestFor: `Choose the plush Lucille if you're a side sleeper or a lighter-weight sleeper who wants pronounced pressure relief with latex's lively, easy-to-move-on response — the opposite of memory foam's slow cradle. Latex is also naturally resistant to dust mites, a frequent pick for allergy-conscious shoppers looking for a natural latex mattress.`,
  },
  'medium-lucille-luxury-natural-latex-diamond-mattress': {
    construction: `The Lucille Medium pairs a natural latex comfort system with Diamond's own pocketed coil core under a luxury euro top — the balanced-feel build in the Lucille line. Latex responds instantly and breathes better than dense synthetic foams, and Diamond assembles the whole mattress, coils to cover, in its Southern California factory.`,
    bestFor: `The medium Lucille is the couples' pick of the line: side sleepers get genuine pressure relief from the latex euro top, back sleepers keep spinal support from the coil core, and combination sleepers move easily on latex's responsive surface. A natural latex mattress in a medium feel covers the widest range of sleep styles.`,
  },
  'firm-lucille-natural-latex-generation-diamond-mattress': {
    construction: `The Lucille Firm delivers natural latex's benefits in the line's most supportive tune: firmer latex layers over Diamond's in-house pocketed coils beneath a low-loft luxury euro top, so the latex conforms at the surface while the build stays decisively supportive underneath.`,
    bestFor: `A firm natural latex mattress is a specific and hard-to-find combination: back and stomach sleepers who want latex's cool, buoyant, chemical-conscious feel without softness, and heavier sleepers who sink too far into plush latex builds. If firm innersprings feel dead and firm memory foam sleeps hot, this is the third path.`,
  },
  'firm-diana-luxury-natural-latex-euro-top-diamond-mattress': {
    construction: `The Diana Firm is a 14-inch luxury natural latex euro top mattress — a taller, more layered build than the Lucille line, stacking firm natural latex over Diamond's pocketed coil system with a substantial euro top crown. Diamond handcrafts the Diana in Southern California with its own coils, foams, and fabrics.`,
    bestFor: `The firm Diana suits back and stomach sleepers who want a luxury-height latex mattress with real pushback, and larger-framed sleepers who need the deeper 14-inch build's extra support range. You get the cool, resilient feel of natural latex with the stability of a firm coil foundation.`,
  },
  'diana-natural-latex-luxury-medium-euro-top-by-diamond-mattress': {
    construction: `The Diana Medium layers responsive natural latex over Diamond's in-house pocketed coils beneath a plush-but-balanced euro top — the middle tune of the Diana luxury latex line. The latex comfort system breathes naturally and rebounds instantly, while the coil core keeps the deep support consistent edge to edge.`,
    bestFor: `The medium Diana fits the widest range of sleepers in the line: side and combination sleepers get euro-top pressure relief, couples get latex's easy repositioning and natural temperature neutrality, and anyone comparing a natural latex mattress against premium memory foam will feel the difference in responsiveness immediately.`,
  },
  'diana-natural-latex-luxury-plush-euro-top-diamond-mattress': {
    construction: `The Diana Plush is the softest expression of Diamond's luxury latex program: a 16-inch natural latex euro top mattress with a deep, cloud-soft crown over resilient latex comfort layers and Diamond's own pocketed coil core. At 16 inches it's a statement-height luxury build, handcrafted in Southern California.`,
    bestFor: `Side sleepers and lighter-weight sleepers who love a deep plush mattress — but have been burned by hot, slow-response memory foam pillow tops — are the Diana Plush's audience. Natural latex keeps the plush surface cool and springy, so you settle in without feeling stuck.`,
  },
  'diamond-technogel-technology-armonia-foam-mattress-11': {
    construction: `The Armonia is built around Technogel® — a distinctive gel technology that's solid, pliable, and dramatically cooler-running than standard gel-infused foams — layered over CertiPUR-US certified support foams in an 11-inch firm all-foam build. Technogel deforms in three dimensions, so it relieves pressure without the trapped-heat feel of traditional memory foam.`,
    bestFor: `The Armonia suits hot-sleeping back and stomach sleepers who want a firm foam mattress that actively manages temperature, and anyone drawn to memory foam's contouring but not its warmth or slow response. It's one of the few genuinely cool-to-the-touch firm foam builds in our showrooms.`,
  },
  'diamond-technogel-melodia-medium-firm': {
    construction: `The Melodia is the flagship of Diamond's Technogel® line: a 14-inch medium-firm mattress with a thick Technogel comfort layer — solid, three-dimensional gel rather than gel-flecked foam — over premium CertiPUR-US certified foams. The result is deep pressure relief with a distinctly cool, fluid surface feel you won't mistake for ordinary memory foam.`,
    bestFor: `Choose the Melodia if you run hot at night but need real contouring: side and combination sleepers get Technogel's pressure relief, back sleepers get medium-firm alignment, and the gel surface stays cool through the night. It's the mattress our consultants show shoppers who've returned hot-sleeping memory foam beds elsewhere.`,
  },
  'diamond-glory-plush-cool-gel-swirl-memory-foam-12-mattress': {
    construction: `The Glory Plush is a 12-inch all-foam build from Diamond's Dreamstage 2.0 collection: cool gel swirl memory foam — visibly swirled gel through the comfort layer for more even cooling than spot infusions — over graduated CertiPUR-US certified support foams, made start-to-finish in Diamond's Southern California plant.`,
    bestFor: `The plush tune suits side sleepers and lighter bodies who want deep, cradling pressure relief at the shoulder and hip with better temperature control than classic memory foam. Couples also get memory foam's signature motion isolation — movement on one side stays on that side.`,
  },
  'diamond-glory-medium-cool-gel-swirl-memory-foam-12-mattress': {
    construction: `The Glory Medium carries the Dreamstage 2.0 collection's cool gel swirl memory foam — gel swirled through the full comfort layer rather than sprinkled in — over firmer CertiPUR-US certified base foams in a 12-inch build balanced between cradle and support.`,
    bestFor: `A medium gel memory foam mattress is the versatile middle of the range: side and back sleepers both land in a comfortable zone, couples benefit from foam's motion isolation, and the swirl-cooled surface addresses the heat that turns many shoppers away from memory foam.`,
  },
  'diamond-dreamstage-2-0-collection-glory-firm-cool-gel-swirl-memory-foam-12-mattress': {
    construction: `The Glory Firm puts the Dreamstage 2.0 cool gel swirl comfort layer over a noticeably firmer CertiPUR-US certified foam core — a 12-inch memory foam mattress that contours only at the surface and holds a flat, supportive posture beneath.`,
    bestFor: `Back and stomach sleepers who want gel memory foam's cool contouring without softness are the Glory Firm's audience — the surface relieves pressure points while the firm core keeps hips level. It's also the Glory to pick if you're heavier and found the medium version too yielding in the showroom.`,
  },
  'diamond-dreamstage-collection-2-0-grace-firm-gel-swirl-memory-foam-12-mattress': {
    construction: `The Grace Firm is a 12-inch Dreamstage 2.0 memory foam build with a quilted top over gel swirl memory foam and a firm CertiPUR-US certified support core. The quilted surface adds a touch of immediate softness the moment you lie down, while the firm foam structure beneath does the real support work.`,
    bestFor: `Pick the Grace Firm if you want a firm mattress that doesn't feel hard on first touch — the quilting takes the edge off while the core stays supportive for back and stomach sleeping. The gel swirl layer keeps the foam sleeping cooler than traditional builds.`,
  },
  'diamond-dreamstage-2-0-medium-gel-swirl-memory-foam-12-mattress': {
    construction: `The Grace Medium pairs a quilted sleep surface with the Dreamstage 2.0 collection's gel swirl memory foam over a medium CertiPUR-US certified core — a 12-inch mattress that leads soft and settles into balanced support, all made in Diamond's own Southern California factory.`,
    bestFor: `The quilted-medium combination is a crowd-pleaser: side sleepers get immediate surface give plus foam contouring, back sleepers keep alignment from the medium core, and the gel swirl cooling makes it a safer bet than classic memory foam for warm sleepers.`,
  },
  'diamond-dreamstage-2-0-grace-plush-gel-swirl-memory-foam-12-mattress': {
    construction: `The Grace Plush is the softest of the Grace trio: a quilted plush top over deep gel swirl memory foam comfort layers and a CertiPUR-US certified foam core, 12 inches tall. Two softness systems stack here — quilting for instant give, memory foam for slow, conforming cradle — with swirled gel keeping the surface temperate.`,
    bestFor: `Dedicated side sleepers and smaller-framed sleepers chasing maximum pressure relief will feel the Grace Plush's appeal immediately. It's the deepest hug in the Dreamstage 2.0 foam lineup — if you've always wanted a plush mattress that doesn't sleep hot, start here.`,
  },
  'diamond-dreamstage-2-0-collection-tranquility-plush-titanium-memory-foam-euro-top-16-mattress': {
    construction: `The Tranquility Plush is a 16-inch statement build: titanium-infused memory foam — infused for cooling and durability — under a deep plush euro top, over Diamond's CertiPUR-US certified support system. It's the tallest, most luxurious profile in the Dreamstage 2.0 collection, handcrafted in Southern California.`,
    bestFor: `Side sleepers who want hotel-suite height and a deep, enveloping euro top get exactly that here, with the titanium-infused foam running cooler and resisting the early softening that plagues budget plush builds. Pair it with a low-profile foundation if overall bed height is a concern — it's a genuinely tall mattress.`,
  },
  'diamond-dreamstage-2-0-collection-medium-titanium-memory-foam-euro-top-16-mattress': {
    construction: `The Tranquility Medium stacks titanium-infused memory foam beneath a balanced euro top in a 16-inch profile — the middle tune of Diamond's tallest Dreamstage 2.0 line. Titanium infusion helps the foam shed heat and hold its feel over years of nightly use.`,
    bestFor: `The medium Tranquility suits couples and combination sleepers who want luxury height and euro-top comfort without committing to plush softness — side sleepers get relief, back sleepers keep support. If you're comparing against big-brand luxury foam beds, this is the Diamond to test first.`,
  },
  'diamond-dreamstage-2-0-collection-tranquility-firm-gel-memory-foam-tight-top-16-mattress': {
    construction: `The Tranquility Firm takes the collection's 16-inch build in the opposite direction: gel memory foam under a smooth tight top — no euro-top softness — over a firm CertiPUR-US certified core. All the height and durability of the Tranquility line with a flat, supportive sleeping surface.`,
    bestFor: `This is the rare luxury-height firm mattress: back and stomach sleepers who want a substantial, premium build without any pillowy give, and heavier sleepers who benefit from the deeper support stack a 16-inch profile provides. The gel-infused foam keeps the firm surface from sleeping warm.`,
  },
  'diamond-dreamstage-2-0-collection-clarity-plush-cool-copper-gel-memory-foam-13-mattress': {
    construction: `The Clarity Plush is a 13-inch all-foam mattress built around cool copper gel memory foam — copper infusion conducts heat away from the body faster than standard gel and adds natural freshness benefits. Plush comfort layers sit over a graduated CertiPUR-US certified support core, made in Diamond's Southern California factory.`,
    bestFor: `Hot-sleeping side sleepers are the Clarity Plush's sweet spot: deep memory-foam pressure relief with copper's superior heat conduction. If you love the plush memory foam feel but wake up warm on a conventional build, the copper mattress difference is what you're shopping for.`,
  },
  'diamond-dreamstage-2-0-collection-clarity-medium-cool-copper-gel-memory-foam-13-mattress': {
    construction: `The Clarity Medium runs cool copper gel memory foam — copper-infused for faster heat transfer — over a balanced CertiPUR-US certified foam core in a 13-inch profile. The medium tune positions it between the collection's plush and firm builds.`,
    bestFor: `A medium copper-infused memory foam mattress covers side, back, and combination sleepers in one build, with cooling that outperforms standard gel foams. It's also a smart couples' pick: balanced feel, strong motion isolation, and a surface that stays temperate on both sides of the bed.`,
  },
  'diamond-dreamstage-2-0-collection-clarity-firm-cool-copper-gel-memory-foam-13-mattress': {
    construction: `The Clarity Firm anchors the copper line's all-foam builds: 13 inches of cool copper gel memory foam over a firm CertiPUR-US certified support core. Copper infusion moves heat out of the comfort layer while the firm base keeps the surface flat and stable.`,
    bestFor: `Back and stomach sleepers who run hot get a purpose-built answer here — firm alignment plus copper-accelerated cooling. It also suits heavier sleepers who compress standard-firmness foam builds past their comfort zone.`,
  },
  'diamond-dreamstage-2-0-collection-clarity-plush-hybrid-cool-copper-gel-memory-foam-14-mattress-copy': {
    construction: `The Clarity Plush Hybrid combines the collection's cool copper gel memory foam with Diamond's own pocketed coil core — a 14-inch hybrid mattress that adds coil airflow, bounce, and edge support to the copper foam's cooling and pressure relief. Diamond builds its coils in-house in Southern California.`,
    bestFor: `Side sleepers who want plush copper-cooled comfort but found all-foam beds too still or too warm should try this hybrid: the coil core breathes, responds, and supports the mattress edge for sitting and sleeping. It's the plushest way into the Clarity hybrid family.`,
  },
  'diamond-dreamstage-2-0-collection-clarity-medium-hybrid-cool-copper-gel-memory-foam-12-mattress-copy': {
    construction: `The Clarity Medium Hybrid is a 12-inch hybrid mattress pairing cool copper gel memory foam comfort layers with Diamond's in-house pocketed coils. Copper infusion cools the surface; the individually wrapped coils add airflow underneath, targeted support, and a responsive feel foam alone can't match.`,
    bestFor: `This is the balanced pick of the copper hybrids: medium feel for side, back, and combination sleepers, hybrid responsiveness for people who change positions at night, and dual-path cooling (copper above, coil airflow below) for warm sleepers and warm bedrooms alike.`,
  },
  'diamond-dreamstage-2-0-collection-clarity-firm-hybrid-cool-copper-gel-memory-foam-14-mattress': {
    construction: `The Clarity Firm Hybrid stacks cool copper gel memory foam over a firm in-house pocketed coil unit in a 14-inch build — the most supportive configuration of Diamond's copper collection, with coil edge support and airflow under a copper-cooled surface.`,
    bestFor: `Back and stomach sleepers wanting a firm hybrid mattress with serious cooling should shortlist this build, as should heavier sleepers — the firm coil core carries more weight with less sink than any all-foam Clarity. Copper infusion keeps the firmer, closer-to-the-surface sleep position temperate.`,
  },
  'diamond-black-diamond-collection-snowbird-plush-hybrid-titanium-memory-foam-15-mattress': {
    construction: `The Snowbird Plush leads Diamond's premium Black Diamond collection: a 15-inch hybrid layering titanium-infused memory foam — cooled and reinforced by the infusion — over Diamond's in-house pocketed coil system, wrapped in the collection's upgraded materials and hand-built in Southern California.`,
    bestFor: `This is Diamond's answer to flagship plush hybrids from the national brands: side sleepers get deep, cool pressure relief, couples get coil support with foam motion damping, and the 15-inch premium build signals its intent the moment you lie on it in our showrooms.`,
  },
  'diamond-black-diamond-collection-snowbird-medium-hybrid-15-mattress': {
    construction: `The Snowbird Medium is the balanced tune of the Black Diamond flagship line: a 15-inch hybrid pairing premium memory foam comfort layers with Diamond's own pocketed coils, built for durable, luxury-grade support with a feel that splits the difference between cradle and lift.`,
    bestFor: `Couples with different sleep positions get the most from the Snowbird Medium — side sleepers sink comfortably into the foam layers while back sleepers ride the coil support, and nobody transmits motion across the bed. It's the Black Diamond to test if you're undecided on firmness.`,
  },
  'diamond-black-diamond-collection-snowbird-firm-hybrid-cool-gel-memory-foam-mattress': {
    construction: `The Snowbird Firm completes the Black Diamond trio with cool gel memory foam over a firm in-house pocketed coil core — a premium firm hybrid mattress where the gel-infused surface tempers heat and the coil system delivers decisive, edge-to-edge support.`,
    bestFor: `Back and stomach sleepers shopping the luxury tier — and heavier sleepers who need flagship-grade support that won't soften early — are the Snowbird Firm's audience. You get Black Diamond materials and construction with the firmest feel in the collection.`,
  },
  'helix-sunset-15-soft-hybrid-elite-mattress': {
    construction: `The Sunset Elite is the plushest build in Helix's top-tier Elite collection: a 15-inch soft hybrid with a deep pillow top, GlacioTex™ cooling cover, and triple-zoned individually wrapped coils that support the hips more firmly than the shoulders. Designed in New York, built in Arizona from CertiPUR-US certified foams.`,
    bestFor: `Dedicated side sleepers — especially lighter-weight sleepers who never quite sink into ordinary "soft" beds — are exactly who Helix engineered the Sunset for. The zoned coils keep hips aligned while the pillow top swallows shoulder pressure, and GlacioTex keeps the plush surface cool.`,
  },
  'helix-sleep-elite-collection-midnight-elite-luxury-plush-15-mattress': {
    construction: `The Midnight Elite takes Helix's most popular sleep profile — the side-sleeper-focused Midnight — to the Elite tier: 15 inches tall with a luxury plush feel, GlacioTex™ cooling cover, premium quilted pillow top, and zoned coil support built on Helix's data-driven fit system. CertiPUR-US certified foams, made in Arizona.`,
    bestFor: `Side sleepers who want the Midnight's celebrated pressure relief in its most luxurious expression should start here. The Elite build adds height, plusher quilting, and stronger cooling than the Core and Luxe tiers — the version for shoppers cross-checking flagship beds from premium national brands.`,
  },
  'helix-luxe-collection-twilight-elite-mattress': {
    construction: `The Twilight Elite is the firm flagship of Helix's Elite collection: a 15-inch luxury firm hybrid with GlacioTex™ cooling cover, reinforced zoned coils, and CertiPUR-US certified comfort foams tuned for pushback rather than plush. Helix designs each model around a specific sleeper profile — Twilight is the firm-and-cool one.`,
    bestFor: `Back and stomach sleepers — and side sleepers above about 130 lbs who bottom out softer beds — get the Twilight Elite's firm, zoned support with genuine luxury materials. If you want a firm mattress that still opens with a premium quilted feel, this is Helix's best expression of it.`,
  },
  'helix-moonlight-15-medium-soft-hybrid-elite-mattress': {
    construction: `The Moonlight Elite is Helix's medium-soft profile at full Elite specification: 15 inches of zoned hybrid construction with a GlacioTex™ cooling cover and premium CertiPUR-US certified foams, engineered for sleepers who sit between the Sunset's plush and the Midnight's medium feels.`,
    bestFor: `Stomach-and-side combination sleepers, couples splitting the difference on firmness, and lighter back sleepers land in the Moonlight's medium-soft zone. The Elite build keeps its cool under the plusher surface — the common failure point of soft-leaning luxury beds.`,
  },
  'helix-plus-elite-15-firm-hybrid-mattress-for-plus-size-sleepers': {
    construction: `The Helix Plus Elite is purpose-built for bigger bodies at the top of Helix's range: a 15-inch firm hybrid engineered with reinforced zoned coils, high-density CertiPUR-US certified foams, and a GlacioTex™ cooling cover — every layer specified for durability under higher body weight.`,
    bestFor: `Sleepers 230 lbs and up finally get a luxury-tier mattress designed around them rather than adapted for them: firm, deep support that resists body impressions, cooling that works under real load, and the durability engineering the plus-size category usually lacks. This is the strongest mattress for heavy people in our Helix lineup.`,
  },
  'helix-plus-11-5-firm-hybrid-mattress-for-plus-size-sleepers': {
    construction: `The Helix Plus is the accessible entry to Helix's plus-size engineering: an 11.5-inch firm hybrid with reinforced individually wrapped coils and high-density CertiPUR-US certified foams selected specifically for durability and support at higher body weights. Designed in New York, made in Arizona.`,
    bestFor: `Sleepers over 230 lbs who want firm, dependable support without stepping up to Elite pricing should start with the Helix Plus — it's built to hold its feel where standard mattresses develop early body impressions. Back, stomach, and side sleepers with larger frames are all within its design brief.`,
  },
};

const HANDLE_TO_ID = {
  'topaz-diamond-mattress': 'gid://shopify/Product/7637667447037',
  'rock-extra-firm-mattress-diamond-mattress': 'gid://shopify/Product/7459998630141',
};
// Remaining GIDs resolved live by handle at run time (products created
// after the last inventory snapshot may carry new IDs).

const ENDPOINT = `https://${STORE}/admin/api/${VERSION}/graphql.json`;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seo-backfills');
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const normalize = (s) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

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

async function fetchProduct(handle) {
  const known = HANDLE_TO_ID[handle];
  if (known) {
    const d = await gql(
      `query F($id: ID!) { product(id: $id) { id handle title descriptionHtml } }`,
      { id: known },
    );
    if (d.product) return d.product;
  }
  const d = await gql(
    `query F($q: String!) { products(first: 1, query: $q) { nodes { id handle title descriptionHtml } } }`,
    { q: `handle:${handle}` },
  );
  return d.products.nodes[0] || null;
}

async function updateDescription(id, descriptionHtml) {
  const d = await gql(
    `mutation U($input: ProductInput!) { productUpdate(input: $input) { product { id } userErrors { field message } } }`,
    { input: { id, descriptionHtml } },
  );
  const errs = d.productUpdate.userErrors;
  if (errs.length) throw new Error(`userErrors: ${JSON.stringify(errs)}`);
}

/**
 * Replace the paragraph following each of the two templated section
 * headers. Returns null when either section is missing (product is then
 * skipped — never partially edited). Header match tolerates the
 * HTML-entity ampersand emitted by the original enrichment.
 */
function diversify(html, copy) {
  const sections = [
    [/(<h3>Technology (?:&amp;|&) Construction<\/h3>\s*)<p>[\s\S]*?<\/p>/, copy.construction],
    [/(<h3>Who This Mattress Is Best For<\/h3>\s*)<p>[\s\S]*?<\/p>/, copy.bestFor],
  ];
  let out = html;
  for (const [re, text] of sections) {
    if (!re.test(out)) return null;
    out = out.replace(re, `$1<p>${text}</p>`);
  }
  return out;
}

// ===== main =====
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const handles = positional.length ? positional : Object.keys(COPY);
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 20);
const mode = APPLY ? 'apply' : 'dryrun';
const report = { ts, mode, handles: handles.length, results: [] };

for (const handle of handles) {
  const copy = COPY[handle];
  if (!copy) {
    console.error(`SKIP ${handle}: no copy table entry`);
    report.results.push({ handle, status: 'no-copy-entry' });
    continue;
  }
  try {
    const product = await fetchProduct(handle);
    if (!product) {
      console.error(`SKIP ${handle}: product not found`);
      report.results.push({ handle, status: 'not-found' });
      continue;
    }
    const next = diversify(product.descriptionHtml ?? '', copy);
    if (next === null) {
      console.error(`SKIP ${handle}: expected section headers not found`);
      report.results.push({ handle, status: 'sections-missing' });
      continue;
    }
    if (normalize(next) === normalize(product.descriptionHtml)) {
      console.log(`OK   ${handle}: already diversified (no-op)`);
      report.results.push({ handle, status: 'noop' });
      continue;
    }
    if (!APPLY) {
      console.log(`DRY  ${handle}: would update (${product.descriptionHtml.length} -> ${next.length} chars)`);
      report.results.push({ handle, status: 'would-update', before: product.descriptionHtml.length, after: next.length });
      continue;
    }
    const expected = sha256(normalize(next));
    await updateDescription(product.id, next);
    const check = await fetchProduct(handle);
    const got = sha256(normalize(check.descriptionHtml ?? ''));
    if (got !== expected) {
      console.error(`ROLLBACK ${handle}: verify mismatch — restoring original`);
      await updateDescription(product.id, product.descriptionHtml);
      report.results.push({ handle, status: 'rolled-back' });
      process.exitCode = 1;
      continue;
    }
    console.log(`APPLIED ${handle} (${product.descriptionHtml.length} -> ${next.length} chars)`);
    report.results.push({ handle, status: 'applied', before: product.descriptionHtml.length, after: next.length });
  } catch (err) {
    console.error(`ERROR ${handle}: ${err.message}`);
    report.results.push({ handle, status: 'error', error: err.message });
    process.exitCode = 1;
  }
}

await mkdir(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, `pdp-diversify-${ts}-${mode}.json`);
await writeFile(outPath, JSON.stringify(report, null, 2));
console.log(`\nReport written: ${outPath}`);
