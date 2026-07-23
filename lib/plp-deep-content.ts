/**
 * Per-collection long-form deep-content fallback for the PLP
 * "About X" block. Renders below the product grid in
 * <PlpContentBlock> when the merchant hasn't authored a
 * `descriptionHtml` for the collection.
 *
 * Phase 308 SEO audit (Semrush 20260530): the high-traffic
 * collection PLPs were flagged for `low_word_count`,
 * `low_readability`, and `missing_related_words` — competitors had
 * deeper category content under the product grid that we either
 * didn't surface (when merchant body is empty) or rendered as
 * short, dense paragraphs. The PlpContentBlock structure was right
 * (long-form intro + FAQ + link cluster); the gap was that the
 * "long-form intro" slot was empty on many of our highest-traffic
 * PLPs because the merchant hasn't published `descriptionHtml` for
 * them yet.
 *
 * This file is the code-side fallback: 350-450 words of structured
 * prose per collection, written to:
 *   - Cover the related semantic terms Semrush flagged as missing
 *     (firmness tiers, material specifics, brand history, comfort
 *     features, who-it-fits)
 *   - Stay readable (short sentences, simple structure — Flesch
 *     score ≥60)
 *   - Use natural anchor text for internal links to adjacent
 *     collections / size pages / showrooms
 *   - Not bury or duplicate the per-product copy that lives on PDPs
 *
 * Returns an HTML string (already sanitized — these are
 * hand-authored, no merchant input). The PlpContentBlock renders it
 * via dangerouslySetInnerHTML in the same slot the merchant body
 * would occupy. When the merchant DOES later author a body for the
 * collection in Shopify Admin, that wins (descriptionHtml takes
 * priority); the fallback only runs in the empty case.
 *
 * Strategy: substring-match the handle against patterns, same as
 * categoryIntroFor / categoryFaqFor / categoryGuidesFor in
 * lib/plp-content.ts. Order matters — brand-specific patterns
 * before material-specific, before size-specific, before generic.
 *
 * Returns empty string when no pattern matches; callers should
 * gate rendering on truthy.
 */

const SHOWROOMS_HREF = '/pages/mattress-store-locations';
const SLEEP_QUIZ_HREF = '/sleep-quiz';

function brandBlock(opts: {
  brand: string;
  oneliner: string;
  builds: string;
  hallmark: string;
  fitsWho: string;
  brandLandingHref?: string;
}): string {
  const { brand, oneliner, builds, hallmark, fitsWho, brandLandingHref } = opts;
  return [
    `<p><strong>${brand}</strong> is ${oneliner}</p>`,
    `<p>The lineup we carry: ${builds} Each step up in tier adds coil count, foam density, and cover materials, so picking the right one is mostly about how much pressure relief you want at the shoulders and hips, and how cool you sleep.</p>`,
    `<p>${hallmark}</p>`,
    `<p><strong>Who ${brand} fits.</strong> ${fitsWho} If you're unsure which model is right, take our <a href="${SLEEP_QUIZ_HREF}">2-minute sleep quiz</a> for a category recommendation, then come into any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a> to lie on the finalists.</p>`,
    brandLandingHref
      ? `<p>Full brand details, model lineups, and pricing tiers live on the <a href="${brandLandingHref}">${brand} brand page</a>.</p>`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function sizeBlock(opts: {
  size: string;
  inches: string;
  feet: string;
  bestFor: string;
  pairsWith: string;
  roomNote: string;
}): string {
  const { size, inches, feet, bestFor, pairsWith, roomNote } = opts;
  return [
    `<p>A <strong>${size}</strong> mattress measures ${inches} (${feet}). ${bestFor}</p>`,
    `<p><strong>What pairs with a ${size}.</strong> ${pairsWith}</p>`,
    `<p><strong>Room sizing.</strong> ${roomNote} See the <a href="/pages/mattress-sizes">full mattress size chart</a> for every size compared, including the dimensions in feet, inches, and centimeters.</p>`,
    `<p>Every ${size} mattress on this page ships with free white-glove delivery across <a href="${SHOWROOMS_HREF}">Los Angeles</a>, same-day setup on most in-stock orders, and the 120-night Love Your Bed comfort exchange so you can swap firmness if it isn't right at home.</p>`,
  ].join('\n');
}

function materialBlock(opts: {
  material: string;
  oneliner: string;
  feel: string;
  bestFor: string;
  tradeoff: string;
}): string {
  const { material, oneliner, feel, bestFor, tradeoff } = opts;
  return [
    `<p>${oneliner}</p>`,
    `<p><strong>How ${material} feels.</strong> ${feel}</p>`,
    `<p><strong>Who ${material} fits.</strong> ${bestFor}</p>`,
    `<p><strong>The trade-off.</strong> ${tradeoff} Match the construction to how you sleep first; brand preference is a distant second on this material.</p>`,
    `<p>Try ${material} side-by-side with the other categories at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a>, or take the <a href="${SLEEP_QUIZ_HREF}">sleep quiz</a> for a personalized recommendation.</p>`,
  ].join('\n');
}

/**
 * Firmness-tier block. The firmness collections (extra-firm … ultra-plush)
 * had no deep-content coverage — they rendered just the FAQ + link cluster
 * while every brand/material/size PLP got ~350 words (SEMrush 20260716:
 * the firmness PLPs were the remaining thin long-form slots). Same opts
 * shape as materialBlock; per-tier copy carries the uniqueness so no two
 * firmness pages read alike.
 */
function firmnessBlock(opts: {
  tier: string;
  scale: string;
  oneliner: string;
  feel: string;
  fitsWho: string;
  materialNote: string;
}): string {
  const { tier, scale, oneliner, feel, fitsWho, materialNote } = opts;
  return [
    `<p>${oneliner}</p>`,
    `<p><strong>Where ${tier} sits on the scale.</strong> Mattress firmness runs 1–10, where 1 is hospital-soft and 10 is plywood-hard. ${tier} lands around ${scale}. Brand naming varies wildly, one maker's "medium" is another's "medium-firm", so the number is a starting point, not a guarantee; feel it in person before you commit.</p>`,
    `<p><strong>How ${tier} feels.</strong> ${feel}</p>`,
    `<p><strong>Who ${tier} fits.</strong> ${fitsWho}</p>`,
    `<p><strong>Material matters as much as the label.</strong> ${materialNote} Not sure which tier is right for your body and sleep position? Take our <a href="${SLEEP_QUIZ_HREF}">2-minute sleep quiz</a>, then lie on the finalists at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a>, firmness is the one spec photos can't convey.</p>`,
  ].join('\n');
}

/**
 * Returns long-form HTML for the collection's "About X" block, or
 * empty string when no pattern matches. Order: brand → material →
 * firmness → accessory → size → sale → generic.
 */
export function categoryDeepContentFor(handle: string, _title: string): string {
  const h = handle.toLowerCase();

  // ── Brand collections ─────────────────────────────────────────
  if (h.includes('tempur')) {
    return brandBlock({
      brand: 'Tempur-Pedic',
      oneliner:
        'the original memory-foam mattress brand, built around TEMPUR, the NASA-developed pressure-relieving foam that gave the category its name in 1992. Every model on this page is engineered, built, and shipped from the same Lexington, Kentucky facility the brand has used for three decades.',
      builds:
        'the all-foam Tempur-Cloud as the entry tier; Tempur-Adapt and Tempur-ProAdapt as the mid-tier all-foam workhorses; Tempur-LuxeAdapt as the flagship all-foam with the deepest comfort layer; and Tempur-Breeze (ProBreeze and LuxeBreeze) for hot sleepers, phase-change cooling baked into the cover and the top comfort layer.',
      hallmark:
        '<strong>What makes Tempur-Pedic feel different.</strong> The TEMPUR material is denser than third-party "memory foam", it responds slowly to body weight rather than springing back fast, which means deeper contouring at the shoulders and hips. That same density is why a Tempur-Pedic costs more than a generic foam mattress of the same height: more pounds of foam in the build.',
      fitsWho:
        'Side sleepers who want serious pressure relief, anyone with chronic shoulder or hip pain, couples where one partner moves at night (TEMPUR isolates motion exceptionally well), and shoppers who want the longest in-category warranty (10 years prorated).',
    });
  }
  if (h.includes('stearns') && h.includes('foster')) {
    return brandBlock({
      brand: 'Stearns & Foster',
      oneliner:
        'a hand-tufted, hand-built luxury mattress line owned by Sealy, built in the US since 1846 with the brand\'s signature IntelliCoil pocketed support and cashmere-blend covers. The hand-tufted construction (Marshall-style two-sided needling) is what gives a Stearns & Foster mattress its distinctive surface and long-term durability.',
      builds:
        'the Estate Collection as the entry-luxury tier; Reserve Collection as the flagship with deeper IntelliCoil support and the brand\'s premium covers; and Lux Estate as the mid-tier with a deeper pillow-top profile. Most models stand 14–17 inches tall, with Euro-top or pillow-top finish.',
      hallmark:
        '<strong>What makes Stearns & Foster different.</strong> The IntelliCoil support unit uses individually-pocketed coils inside larger pocketed coils, a coil-in-coil design that adapts firmness to weight: light pressure gets a softer response, deeper compression engages the inner coil for stronger support. The hand-tufting prevents foam layers from shifting over time, which is why a S&F mattress holds its shape past the 10-year mark when others compress.',
      fitsWho:
        'Shoppers who want a classic American luxury feel (plush pillow-top with real coil support underneath, not all-foam contouring), back and combo sleepers who want supportive but not firm, and anyone who values mattress longevity, these are built to last well over a decade with proper care.',
    });
  }
  if (h.includes('helix')) {
    return brandBlock({
      brand: 'Helix Sleep',
      oneliner:
        'a build-to-fit hybrid brand, every model layers individually-pocketed coils under foam comfort layers and a knit cover. Helix\'s positioning is "the mattress matched to how you sleep," with a public sleep-quiz that recommends a model based on sleep position, body weight, and firmness preference.',
      builds:
        'the Core lineup (Midnight, Sunset, Twilight, Dusk, etc.) as the entry tier; the Luxe collection (Midnight Luxe, Sunset Luxe, etc.) as the mid-tier with deeper coil count and zoned support; and the Elite collection as the flagship with the deepest comfort layer and the most coil density.',
      hallmark:
        '<strong>What makes Helix different.</strong> Every model is hybrid (coil + foam), so the brand\'s positioning is firmness profile and feel, not foam vs. coil. Pocketed coils give you the responsive bounce and edge support pure foam can\'t replicate, while the foam comfort layers do the contouring memory foam is known for. The Luxe and Elite tiers add zoned support (firmer coils under hips, softer under shoulders) for back-pain relief.',
      fitsWho:
        'Most mattress shoppers do well on a hybrid, Helix is our go-to recommendation when a customer wants "the universally comfortable choice" and doesn\'t lean heavily toward all-foam contouring or pure coil bounce. Couples especially benefit from the motion isolation of pocketed coils + foam comfort layers.',
    });
  }
  if (h.includes('diamond')) {
    return brandBlock({
      brand: 'Diamond Mattress',
      oneliner:
        'a Compton, California-based mattress builder founded in 1946, three generations of family-run manufacturing, with most models built within 30 miles of our LA showrooms. Diamond\'s lineup spans memory foam, hybrid, and natural-latex builds with copper-gel cooling tech across the higher tiers.',
      builds:
        'the Dreamstage Collection as the broad entry-to-mid range; the Black Diamond Collection as the premium hand-tufted line; and the Sleep Calm + DreamStage 2.0 builds with the brand\'s cooling copper-gel comfort layer for hot sleepers.',
      hallmark:
        '<strong>What makes Diamond different.</strong> Made in California, shorter supply chain than the East Coast brands, which keeps pricing competitive at every tier, and means warranty service is straightforward (parts and labor stay local). Diamond also offers some of the only natural-latex options under $2,000 we stock, with Talalay latex over a pocketed coil base.',
      fitsWho:
        'Shoppers who want a quality mattress at a more accessible price than Tempur-Pedic or Stearns & Foster, same hand-built construction at a different price tier. Also a strong choice for environmentally-conscious shoppers (CertiPUR-US foams, no chemical fire retardants in the natural-latex builds).',
    });
  }
  if (h.includes('southerland') || h.includes('scandinavian')) {
    return brandBlock({
      brand: 'Southerland',
      oneliner:
        'a Minnesota-based mattress builder with the Scandinavian Collection, a CertiPUR-US-certified latex-and-hybrid lineup built around natural Talalay latex over a pocketed-coil support unit. The brand\'s positioning is "Scandinavian sleep simplicity": clean materials, supportive but not over-engineered, with TENCEL and copper-gel covers across the lineup.',
      builds:
        'the Stockholm, Oslo, and Helsinki models, each layering natural latex differently over the pocketed-coil base. Oslo is the entry tier with a thinner latex comfort layer; Stockholm is the mid-tier with deeper latex; Helsinki is the flagship with the deepest latex and the brand\'s premium cover.',
      hallmark:
        '<strong>What makes Southerland\'s latex different.</strong> Natural Talalay latex is the longest-lasting mattress comfort material we sell, 15+ year typical life span with proper rotation. It runs cooler than memory foam, doesn\'t off-gas, and has a buoyant, responsive feel that doesn\'t sink in. The pocketed-coil base under the latex gives you the edge support an all-latex mattress can\'t.',
      fitsWho:
        'Hot sleepers (latex runs significantly cooler than memory foam), shoppers with joint pain (latex pressure relief without the slow-sinking feel), and anyone who wants a longer-lifespan mattress without paying flagship Tempur-Pedic pricing.',
    });
  }
  if (h.includes('englander')) {
    return brandBlock({
      brand: 'Englander',
      oneliner:
        'a fourth-generation American mattress builder, owned by the same family since 1894, with manufacturing in Tennessee. The brand is best known for the O\'Conner and Allendale luxury innerspring lines: pocketed-coil support with gel-infused memory foam comfort layers, in firm Euro-top and plush box-top builds.',
      builds:
        'the Tension Ease tier as the entry; the O\'Conner Collection as the mid-tier hybrid; and the Allendale Collection as the flagship with the deepest comfort layer, hand-tufted finish, and Englander\'s thickest pocketed-coil unit.',
      hallmark:
        '<strong>What makes Englander different.</strong> Stronger emphasis on traditional innerspring construction than the foam-forward brands, even the hybrid models lean toward the bounce and edge support of coils rather than the deep contouring of all-foam builds. Made in the USA in heights from 14–17 inches, with both firm and plush options at every tier.',
      fitsWho:
        'Back and stomach sleepers who want a firmer, more supportive feel than memory foam provides. Combo sleepers who change positions through the night benefit from the easy turn-over of a coil-forward construction. Shoppers replacing an older innerspring mattress and wanting the same feel-family.',
    });
  }
  if (h.includes('eastman')) {
    return brandBlock({
      brand: 'Eastman House',
      oneliner:
        'a Detroit-area mattress builder founded in 1866, one of the oldest continuously-operating mattress makers in North America. The brand\'s lineup is built around hand-tufted innerspring and hybrid construction with natural materials (wool, cotton, silk) across the higher tiers.',
      builds:
        'the Royal Pedic Collection (the original Eastman House line, still hand-tufted) as the heritage tier; and modern hybrid lines that layer pocketed coils with foam, latex, or natural-fiber comfort layers.',
      hallmark:
        '<strong>What makes Eastman House different.</strong> Old-line hand-tufted construction, the same technique used on the high-end heritage lines, applied at every price point. The natural-fiber comfort layers (wool especially) regulate temperature passively without active cooling tech, which appeals to shoppers who don\'t want gel-infused foams or chemical phase-change covers.',
      fitsWho:
        'Heritage-feel shoppers, allergy-sensitive sleepers (natural fibers + tighter ticking weave), and anyone who wants a mattress that smells like a mattress rather than off-gassing foam.',
    });
  }

  if (h.includes('chattam')) {
    return brandBlock({
      brand: 'Chattam & Wells',
      oneliner:
        'a luxury hand-tufted innerspring line built around a pocketed-coil support unit with natural latex and gel-memory-foam comfort layers, finished in damask and cashmere-blend covers. It sits at the top of the traditional innerspring category, the coil-and-latex answer to the all-foam flagships.',
      builds:
        'the Lismore and Miramare "Luxury Firm" builds as the supportive core (13-inch, firmer feel for back sleepers); plush Euro-top and pillow-top models in the 14–18-inch range for deeper pressure relief; and hand-tufted constructions throughout the lineup.',
      hallmark:
        '<strong>What makes Chattam & Wells different.</strong> Hand-tufting, needled construction with no glue between the layers, is what separates a true luxury innerspring from a mass-produced one: the comfort layers can\'t shift, so the mattress holds its shape and firmness for well over a decade. Natural latex over the pocketed coil adds responsive, breathable pressure relief that memory foam alone can\'t match.',
      fitsWho:
        'Shoppers who want a classic luxury innerspring feel, supportive coil bounce with a plush hand-finished top, rather than the deep sink of all-foam. Especially back and combo sleepers, and anyone prioritizing longevity and a cooler-sleeping natural-latex comfort layer.',
    });
  }
  if (h.includes('spring-air') || h.includes('spring air')) {
    return brandBlock({
      brand: 'Spring Air',
      oneliner:
        'one of the longest-running American mattress names, a value-to-mid lineup of innerspring and hybrid builds centered on the Back Supporter zoned pocketed-coil unit, which firms up under the lumbar region for targeted lower-back support without buying up into a luxury tier.',
      builds:
        'the Value Collection as the entry tier (firmer, straightforward innerspring builds from 8 inches, ideal for guest rooms and budgets); and the Tradition Collection as the mid-tier with deeper comfort layers, gel-memory-foam or pillow-top finishes, and heights up to 16 inches.',
      hallmark:
        '<strong>What makes Spring Air different.</strong> The Back Supporter coil zones the support, more coils and a firmer gauge under the midsection where the hips and lower back sink most, so you get lumbar support at an accessible price. It\'s the practical, budget-conscious innerspring choice when a shopper wants firm traditional support over foam contouring.',
      fitsWho:
        'Budget-to-mid shoppers, guest rooms and second bedrooms, and back or stomach sleepers who want firm, traditional innerspring support. Available across firmnesses from firm to plush pillow-top, so most sleep positions are covered within the range.',
    });
  }

  // ── Material categories ───────────────────────────────────────
  if (h.includes('memory-foam') || (h.includes('foam') && !h.includes('gel'))) {
    return materialBlock({
      material: 'memory foam',
      oneliner:
        'Memory foam contours to your body and isolates motion better than any other mattress type. It\'s the most-recommended material for side sleepers, anyone with pressure points at the shoulders and hips, and couples where one partner moves a lot at night.',
      feel: 'Slow-responding, body-conforming, "hugging." The foam compresses under heat and pressure, so a memory-foam mattress feels firmer the first minute you lie on it and progressively softer as the foam warms to body temperature. Edge support is softer than a hybrid or innerspring, sitting on the edge sinks more than you\'d expect.',
      bestFor:
        'Side sleepers (the contouring relieves shoulder and hip pressure), combo sleepers who finish the night on their side, anyone with chronic back or joint pain, and couples on different schedules, motion isolation on a quality memory foam is exceptional.',
      tradeoff:
        'Memory foam runs warmer than coils or latex, body heat doesn\'t dissipate through solid foam the way it does through coil airflow. Pick a build with gel infusion, copper, or open-cell phase-change cooling if you sleep hot. The other consideration: getting in and out of bed feels less buoyant than a coil mattress, which some shoppers love and others find harder on mornings.',
    });
  }
  if (h.includes('hybrid')) {
    return materialBlock({
      material: 'a hybrid mattress',
      oneliner:
        'Hybrid mattresses combine memory-foam or latex comfort layers with a pocketed-coil base, the most universally comfortable category we carry. It\'s the answer when a shopper says "I like the feel of memory foam but I also like the bounce of a regular mattress."',
      feel: 'Balanced. The pocketed coils give you the responsive bounce, edge support, and airflow that pure foam can\'t replicate; the foam (or latex) comfort layers above do the contouring foam is known for. Most hybrids land in the medium-to-medium-firm range out of the box, with plush and firm options available at every brand.',
      bestFor:
        'The widest cross-section of shoppers, back sleepers, side sleepers, combo sleepers, couples with different firmness preferences. Hybrids handle weight differences well (a 250-lb partner doesn\'t bottom out next to a 130-lb partner on a pocketed coil unit). Hot sleepers do better on hybrids than on all-foam.',
      tradeoff:
        'Hybrids cost more than all-foam at the same comfort tier (more components, more labor). They\'re also heavier, which matters for moving day. And the trade-off pure foam fans dislike: you don\'t get the "sinking in" feel of an all-foam mattress, even with deep foam comfort layers, the coils underneath always make their presence felt.',
    });
  }
  if (h.includes('latex')) {
    return materialBlock({
      material: 'latex',
      oneliner:
        'Latex is the longest-lasting and most breathable mattress material we sell, 15+ year typical life span with proper rotation. It\'s our top recommendation for hot sleepers and shoppers with joint pain who want pressure relief without the heat retention of memory foam.',
      feel: 'Buoyant and responsive. Latex pushes back faster than memory foam, you don\'t sink into it; you sit on top of it. The contouring is real but feels more like floating than hugging. Both Talalay (lighter, more uniform feel) and Dunlop (denser, more supportive) builds are common; both come from rubber-tree sap.',
      bestFor:
        'Hot sleepers (latex runs significantly cooler than any foam, open-cell structure + better airflow), shoppers with joint pain or arthritis (responsive pressure relief that doesn\'t restrict turning over), allergy sufferers (natural latex is dust-mite and mold resistant), and anyone who wants the longest-lifespan mattress for the money.',
      tradeoff:
        'Higher upfront cost than memory foam or innerspring at the same height, natural Talalay latex is expensive material. Some shoppers don\'t love the buoyancy ("it pushes back too much" is the common complaint); if you came from a memory foam mattress, the responsive feel will be the biggest adjustment. Pure all-latex mattresses also have softer edge support than hybrids.',
    });
  }
  if (h.includes('innerspring')) {
    return materialBlock({
      material: 'innerspring',
      oneliner:
        'Innerspring mattresses use a steel coil support unit topped with comfort foam, fiber, or pillow-top layers, the most traditional mattress construction, with the bounce and edge support that hybrid and foam mattresses don\'t fully replicate.',
      feel: 'Bouncy and responsive. The coils define the feel: pocketed coils (most modern innersprings) isolate motion better than older Bonnell or offset coils, but the bounce is still there. Comfort layers above add pressure relief, but the overall feel is "sleeping on top of the bed" rather than "sinking into it."',
      bestFor:
        'Back and stomach sleepers who want firm support, combo sleepers who change positions a lot (easier to turn over on a coil mattress than a foam one), heavy sleepers who need stronger weight distribution, and shoppers replacing an older innerspring who want the same feel-family.',
      tradeoff:
        'Less motion isolation than pure memory foam, if a partner is a thrasher, a hybrid or all-foam will isolate better. Comfort layers above the coils are usually thinner than on hybrid builds, so pressure relief at the shoulders and hips is less pronounced. Best paired with a pillow-top finish for side sleepers.',
    });
  }
  if (h.includes('cooling') || h.includes('gel')) {
    return materialBlock({
      material: 'a cooling mattress',
      oneliner:
        'Cooling mattresses combine heat-dispersing materials, gel-infused foam, copper, phase-change covers, or breathable hybrid coils, to keep your sleep surface at or below skin temperature through the night. For hot sleepers, this is the single highest-impact mattress feature.',
      feel: 'Varies by build. Gel memory foam still contours but transfers heat faster than standard memory foam. Phase-change covers (PCM) feel cool to the touch when you first lie down because the material absorbs body heat. Hybrid coils underneath always run cooler than all-foam because air moves through the coil unit.',
      bestFor:
        'Hot sleepers, sleeping with a partner, sleeping in a warm climate, menopausal night sweats, or just running hot biologically. Also a good choice for anyone in an LA apartment without strong A/C, since indoor temperatures here run warm year-round.',
      tradeoff:
        'Cooling tech adds cost, premium-tier hybrids and Tempur-Breeze models cost ~$500-1500 more than their non-cooling siblings. Some PCM covers feel "wet-cool" when very cold and lose the effect after the first hour of sleep. Latex and hybrid builds outperform all-foam-with-cooling for sustained overnight thermoregulation.',
    });
  }
  if (h.includes('organic')) {
    return materialBlock({
      material: 'an organic mattress',
      oneliner:
        'Organic mattresses are built from certified-natural materials, GOTS-certified organic cotton covers, GOLS-certified natural Talalay or Dunlop latex, untreated wool batting, with no chemical flame retardants, no synthetic foams, and no off-gassing.',
      feel: 'Firmer than the conventional latex builds and significantly firmer than memory foam, natural materials don\'t compress as deeply. The buoyancy is similar to non-organic latex; the difference is in the surface (cotton + wool reads more like a fine bedsheet than a synthetic cover).',
      bestFor:
        'Allergy sufferers (dust mites can\'t survive in natural latex; wool wicks moisture away from the sleep surface), chemical-sensitivity shoppers, infants and young kids (no flame retardants is the main draw), and anyone who values certified material provenance.',
      tradeoff:
        'Significantly higher cost than conventional builds, GOTS/GOLS certifications add ~30-50% to retail. Lifespan is excellent (15+ years on a quality build) so the cost amortizes, but the upfront price tag is real. Returns and exchanges run lower than synthetic mattresses because resale of opened organic mattresses is restricted.',
    });
  }

  // ── Firmness tiers ───────────────────────────────────────────
  // Order: extra-firm → medium-firm → firm → ultra-plush → plush →
  // medium → soft, so longer/compound handles win before their subset
  // ('medium-firm' before 'firm' and 'medium'; 'ultra-plush' before
  // 'plush'). None of these keywords appear in a brand/material/size
  // handle, so this section is safe anywhere after material.
  if (h.includes('extra-firm')) {
    return firmnessBlock({
      tier: 'extra-firm',
      scale: '8–9 out of 10',
      oneliner:
        'Extra-firm mattresses give the most support and the least sink of any comfort level, a nearly flat sleep surface that keeps your spine level and your hips from dipping into the bed.',
      feel: 'Very little give. You lie on top of the mattress, not in it. Weight is spread broadly across the surface rather than cradled at any one point, and turning over is effortless because nothing grabs you.',
      fitsWho:
        'Stomach sleepers, who need their hips held level with their shoulders; heavier back sleepers; and anyone replacing an old firm innerspring who wants the same taut, supportive feel. It is the one tier where "too firm" is rarely the complaint.',
      materialNote:
        'An extra-firm feel comes from a dense innerspring or hybrid base under a thin comfort layer, coils resist compression better than deep foam. Firm memory foam gets close but rarely this rigid.',
    });
  }
  if (h.includes('medium-firm')) {
    return firmnessBlock({
      tier: 'medium-firm',
      scale: '6–7 out of 10',
      oneliner:
        'Medium-firm is the most-recommended firmness for back pain, the clinical research (Kovacs 2003, Jacobson 2015) found it produces the lowest pain scores across most sleepers. It balances support and pressure relief better than any other tier.',
      feel: 'Supportive underneath with a genuine comfort cushion on top. Your shoulders and hips get light contouring without the deep sink of a plush bed, the all-rounder feel.',
      fitsWho:
        'The widest range of sleepers: back sleepers, most combo sleepers, couples who can\'t agree (this is the compromise tier), and anyone with lower-back pain. Our mattress for back pain collection is tuned to this exact feel.',
      materialNote:
        'Every material makes a good medium-firm, but a medium-firm hybrid is the single most universally comfortable build we sell.',
    });
  }
  if (h.includes('firm')) {
    return firmnessBlock({
      tier: 'firm',
      scale: '7–8 out of 10',
      oneliner:
        'Firm mattresses give supportive, on-top-of-the-bed sleeping without going as rigid as extra-firm, the most popular choice for back and stomach sleepers.',
      feel: 'Supportive with a thin cushion of give at the surface: enough to take the edge off pressure points, not enough to let you sink. Strong edge support and easy movement across the bed.',
      fitsWho:
        'Back sleepers, stomach sleepers, combo sleepers who change positions through the night, and anyone who sleeps hot, a firmer surface means less body contact and better airflow than a plush build.',
      materialNote:
        'Firm comes in every material: firm memory foam, firm hybrid, firm latex, firm innerspring. If you like the support but want more give at the shoulders, step down to medium-firm.',
    });
  }
  if (h.includes('ultra-plush')) {
    return firmnessBlock({
      tier: 'ultra-plush',
      scale: '2–4 out of 10',
      oneliner:
        'Ultra-plush is the softest tier we carry, deep, pillowy sink for sleepers who want to feel enveloped by the bed rather than supported on top of it.',
      feel: 'Maximum cradle. Thick, soft comfort layers let your body settle in deeply and wrap around every curve. Best for lighter sleepers; heavier bodies can sink past the comfort layer to the firmer support below.',
      fitsWho:
        'Dedicated side sleepers with pressure-point pain, lighter-weight sleepers, and anyone upgrading from a plush bed that still felt too firm at the shoulders and hips.',
      materialNote:
        'Ultra-plush almost always means a thick memory foam or pillow-top comfort layer. If you share the bed with a heavier partner, a plush hybrid may serve you both better than a true all-foam ultra-plush.',
    });
  }
  if (h.includes('plush')) {
    return firmnessBlock({
      tier: 'plush',
      scale: '4–5 out of 10',
      oneliner:
        'Plush mattresses are soft and cushioning, built for pressure relief at the shoulders and hips rather than firm support. The go-to comfort level for side sleepers.',
      feel: 'Noticeable sink and cradle. The comfort layers wrap around your body\'s curves, taking pressure off the joints that bear the most weight in a side-lying position.',
      fitsWho:
        'Side sleepers, lighter-weight sleepers (under ~150 lb, who don\'t compress a firmer bed enough to feel its comfort layer), and anyone who likes the "hug" of memory foam. Our mattress for side sleepers collection lists the best matches.',
      materialNote:
        'Plush is where memory foam shines, deep contouring. Plush hybrids add coil support under the soft top for sleepers who want cushioning without losing bounce and edge support.',
    });
  }
  if (h.includes('medium')) {
    return firmnessBlock({
      tier: 'medium',
      scale: '5–6 out of 10',
      oneliner:
        'Medium mattresses sit right in the middle, enough contouring to relieve pressure, enough support to keep you aligned. The safest pick when you\'re not yet sure what firmness you prefer.',
      feel: 'Balanced give. You feel gentle cradling at the shoulders and hips but stay supported through the middle, neither lying "on top of" nor "sinking into" the bed.',
      fitsWho:
        'Combo sleepers who move between back and side, couples with mild preference differences, and first-time buyers who want a crowd-pleaser. Lighter side sleepers often prefer medium over medium-firm.',
      materialNote:
        'A medium memory foam contours more; a medium hybrid stays more responsive. If you sleep mostly on your side, consider stepping down to plush.',
    });
  }
  if (h.includes('soft') || h.includes('pressure-relief') || h.includes('pressure relief')) {
    return firmnessBlock({
      tier: 'soft, pressure-relieving',
      scale: '3–5 out of 10',
      oneliner:
        'These mattresses are built specifically for pressure relief, soft, contouring comfort layers that take the load off the shoulders, hips, and joints. The right category for side sleepers and anyone with joint pain.',
      feel: 'Cushioning and cradling. The surface gives readily and redistributes weight away from your pressure points instead of concentrating it under the heaviest parts of your body.',
      fitsWho:
        'Side sleepers, sleepers with arthritis or chronic joint pain, and anyone who wakes with a numb arm or a sore hip on a firmer bed. Memory foam and plush hybrids do this best.',
      materialNote:
        'Pressure relief comes from the comfort layer, not the support core, look for deep memory foam or latex over a supportive base.',
    });
  }

  // ── Construction / price tiers ────────────────────────────────
  if (h.includes('pocketed-coil') || h.includes('pocket-coil') || h.includes('pocketed coil')) {
    return [
      `<p>Pocketed-coil mattresses use hundreds to thousands of individually fabric-wrapped springs that compress independently, the modern evolution of the old connected-innerspring unit, and the support core inside almost every hybrid mattress we sell.</p>`,
      `<p><strong>Why independent coils matter.</strong> Because each coil moves on its own, weight in one spot doesn't lever the whole surface, that's what gives pocketed-coil beds their strong motion isolation (a partner can shift without waking you) and their contouring support (the coils under your hips compress more than the coils under your waist, keeping your spine level).</p>`,
      `<p><strong>What pocketed coils feel like.</strong> Responsive and supportive with real edge support, you can sit and sleep near the perimeter without rolling off, which pure memory foam can't match. Paired with foam or latex comfort layers on top (a hybrid mattress), you get the contouring of foam and the bounce and airflow of coils in one build.</p>`,
      `<p><strong>Who they fit.</strong> Nearly everyone, couples especially (motion isolation plus edge support), hot sleepers (air moves through the coil unit), and heavier sleepers (coils resist sagging better than all-foam). Compare with all-foam builds in our <a href="/collections/memory-foam-mattresses">memory foam</a> and <a href="/collections/hybrid-mattresses">hybrid</a> collections, or take the <a href="${SLEEP_QUIZ_HREF}">2-minute sleep quiz</a> and try the finalists at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a>.</p>`,
    ].join('\n');
  }
  if (h.includes('luxury')) {
    return [
      `<p>Luxury mattresses are the flagship tier, deeper builds, hand-tufted construction, premium covers (cashmere, silk, wool blends), and the thickest, highest-density comfort layers each brand makes. This is where you'll find Stearns & Foster's Reserve line, Tempur-Pedic's LuxeAdapt and LuxeBreeze, and the top hybrids from every maker we carry.</p>`,
      `<p><strong>What the extra cost buys.</strong> More material and better material. Luxury builds stand 14–17 inches tall with several distinct comfort layers, use higher-density foams that hold their shape past the 10-year mark, and finish with hand-tufting (needled construction) that keeps the layers from shifting over time, the single biggest driver of a mattress lasting a decade-plus versus five years.</p>`,
      `<p><strong>What luxury does not automatically mean.</strong> It doesn't mean softer, luxury models come in firm, medium, and plush just like every other tier. And it doesn't always mean cooler; if you sleep hot, look specifically for a cooling build (gel, copper, or phase-change covers) within the luxury range rather than assuming the premium price includes it.</p>`,
      `<p><strong>Who it fits.</strong> Shoppers prioritizing longevity and finish over lowest price, and anyone who wants the deepest pressure relief a brand offers. Browse by name on the <a href="/collections/stearns-foster-mattresses">Stearns & Foster</a> and <a href="/collections/tempur-pedic-mattresses">Tempur-Pedic</a> collections, or take the <a href="${SLEEP_QUIZ_HREF}">sleep quiz</a> and feel the flagships side-by-side at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a>.</p>`,
    ].join('\n');
  }
  if (h.includes('under-1000') || h.includes('under-$1000') || h.includes('budget')) {
    return [
      `<p>A good mattress under $1,000 is absolutely attainable, this price tier covers quality memory foam, hybrid, and innerspring builds from real brands, not just bargain-bin foam. The difference from the flagship tiers is usually comfort-layer depth, cover materials, and warranty length, not a fundamental drop in support or safety (every mattress we sell is CertiPUR-US certified regardless of price).</p>`,
      `<p><strong>Where the savings come from.</strong> Thinner (but still supportive) comfort layers, simpler covers, and standard rather than premium cooling. A sub-$1,000 build typically stands 10–12 inches tall versus 14–17 for luxury, plenty for most sleepers under ~230 lb.</p>`,
      `<p><strong>How to spend the budget well.</strong> Prioritize the support core (a pocketed-coil hybrid gives more durability per dollar than budget all-foam), match the firmness to your sleep position first, and add a <a href="/collections/mattress-protector">mattress protector</a> to keep the warranty valid. Sales rotate weekly, so a model that's normally over $1,000 often lands in this range during a promo.</p>`,
      `<p><strong>Who it fits.</strong> First apartments, guest rooms, kids' and teens' rooms, and anyone who wants a genuinely comfortable bed without flagship pricing. Browse <a href="/collections/memory-foam-mattresses">memory foam</a> and size options like <a href="/collections/queen-size-mattresses">Queen</a> and <a href="/collections/full-size-mattresses">Full</a>, or take the <a href="${SLEEP_QUIZ_HREF}">sleep quiz</a> for a match within budget.</p>`,
    ].join('\n');
  }

  // ── Accessory categories ──────────────────────────────────────
  if (h.includes('topper')) {
    return [
      `<p>A mattress topper is the easiest way to change how your bed feels without buying a new mattress. Toppers add 1–4 inches of comfort layer on top of your existing mattress, useful for softening a too-firm mattress, adding pressure relief at the shoulders and hips, or cooling a hot sleep surface without replacing the whole bed.</p>`,
      `<p><strong>The four topper materials we stock.</strong> Memory foam toppers (the classic, contouring, motion-isolating, runs warm); gel memory foam (memory foam with cooling infusion for hot sleepers); latex (responsive, breathable, long-lasting); and wool/cotton (natural fiber, regulates temperature, less dramatic firmness change).</p>`,
      `<p><strong>How to pick a topper thickness.</strong> 1–2 inches softens a firm mattress without changing its feel dramatically. 3–4 inches is a noticeable change, closer to "replacing the comfort layer" than "adjusting it." If your mattress is sagging or worn out (5+ years old with body impressions), a topper is a temporary fix; long-term you want a new mattress.</p>`,
      `<p><strong>Sizing notes.</strong> Toppers come in all six standard sizes. Make sure you measure your current mattress depth and check whether your fitted sheets will still fit after a 3–4" topper goes on top, some shoppers also size up to deep-pocket sheets at the same time. Free white-glove delivery on toppers across <a href="${SHOWROOMS_HREF}">Los Angeles</a> on orders that hit the $499 threshold.</p>`,
    ].join('\n');
  }
  if (h.includes('adjustable')) {
    return [
      `<p>Adjustable bases replace your existing mattress foundation and let you raise your head and feet independently, for reading, working, watching TV, easing acid reflux and snoring, taking pressure off the lower back, and elevating swollen feet. Most bases on this page include the zero-gravity preset that levels weight distribution across your body.</p>`,
      `<p><strong>The features that actually matter.</strong> Head and foot articulation (the basics); zero-gravity preset; massage (subtle, foot/leg/full-body zones); USB charging ports; under-bed lighting; wireless or wall-tethered remote; and wall-hugging design (the head section slides back as it lifts so your nightstands stay in reach). Higher tiers add programmable presets and app control.</p>`,
      `<p><strong>What pairs with an adjustable base.</strong> Memory foam, hybrid, and most latex mattresses pair well, the comfort layers bend with the base. Traditional pocketed-coil mattresses pair if the construction allows articulation (most modern ones do; ask if unsure). Pillow-top and Euro-top heights up to 17" fit most adjustable frames.</p>`,
      `<p><strong>Sizing.</strong> Every adjustable base on this page comes in Twin XL, Queen, King, and California King. Split King setups (two Twin XL bases side-by-side) let couples independently adjust their half, the right choice when one partner wants their head up and the other flat. White-glove delivery includes assembly + haul-away of your old foundation; try the controls in person at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a>.</p>`,
    ].join('\n');
  }
  if (h.includes('pillow') && !h.includes('top')) {
    // pillow category, not pillow-top mattress
    return [
      `<p>The right pillow keeps your neck and spine aligned with your mattress, loft (height) should match your sleep position, and material should match your temperature preference and pressure-relief needs. A mismatch between mattress feel and pillow loft is the single most common cause of morning neck pain.</p>`,
      `<p><strong>Pick by sleep position first.</strong> Side sleepers need taller, firmer pillows (5–6" loft) to fill the gap between shoulder and ear. Back sleepers want medium (3–4" loft), enough to support the cervical curve, not so much that the head is pushed forward. Stomach sleepers want thin and soft (2" loft or less); anything more strains the neck.</p>`,
      `<p><strong>The materials.</strong> Memory foam (contours, runs warm); shredded memory foam (adjustable loft, more breathable than solid foam); natural latex (responsive, cool, hypoallergenic); down or down-alternative (soft, packs flat over time); and cooling gel (best for hot sleepers). Match your pillow material to your mattress, a memory-foam pillow on a memory-foam mattress amplifies the warm sink; a latex pillow on a memory-foam mattress balances it.</p>`,
      `<p>Free white-glove delivery on pillow packs across <a href="${SHOWROOMS_HREF}">Los Angeles</a> on qualifying orders. Try the loft and feel in person at any showroom, pillow choice is more individual than mattress choice and harder to get right from photos alone.</p>`,
    ].join('\n');
  }
  if (h.includes('protect') || h.includes('cover')) {
    return [
      `<p>A mattress protector is a barrier between your mattress and everything that lands on it, spills, sweat, skin cells, dust mites, allergens, and (for younger sleepers) accidents. A good protector adds zero feel to the mattress and extends its usable life by 3–5 years. Every mattress warranty we sell requires a protector to stay valid.</p>`,
      `<p><strong>The two protector types.</strong> Encasement (zips around all six sides, the strongest barrier, the only kind that protects against bed bugs); top-only fitted protector (covers the sleep surface plus the side walls, fits like a deep-pocket sheet). Encasement is more secure; fitted is faster to swap and wash.</p>`,
      `<p><strong>Waterproof vs. breathable.</strong> Waterproof protectors use a polyurethane film backing, full liquid barrier, but slightly warmer to sleep on. "Breathable waterproof" uses a vapor-permeable membrane, almost as good a liquid barrier with much better airflow. For hot sleepers, choose breathable waterproof; for kids or pets in bed, choose full waterproof.</p>`,
      `<p><strong>Sizing and pricing.</strong> Protectors come in every standard mattress size and most depths up to 18". Pricing runs $50-150 depending on size and tech. Free white-glove delivery on protectors with any new-mattress purchase across <a href="${SHOWROOMS_HREF}">Los Angeles</a>; pair one with your mattress at checkout to keep the warranty intact from day one.</p>`,
    ].join('\n');
  }
  if (h.includes('bed-frame') || h.includes('foundation') || h.includes('box-spring')) {
    return [
      `<p>What you put under your mattress matters as much as the mattress itself, the wrong foundation can void a mattress warranty, cause premature sagging, or make a brand-new bed feel like a worn-out one. The foundations on this page are matched to every mattress we sell.</p>`,
      `<p><strong>The three foundation types.</strong> Platform bed (slatted base, no box spring needed, most modern beds); traditional box spring (recommended for innerspring mattresses on metal frames); and low-profile foundation (5–8" tall instead of the standard 9–12", to lower the overall bed height when stacking with a pillow-top mattress).</p>`,
      `<p><strong>Slat spacing matters.</strong> If you have a slatted platform frame, the gap between slats should be 3" or less for foam and hybrid mattresses, 4" or less for innerspring. Wider gaps cause premature comfort-layer sag (and void most warranties). Bunkie boards solve the problem by adding a flat plywood layer on top of wide slats.</p>`,
      `<p><strong>Adjustable-base compatibility.</strong> Any mattress that bends without damage (most foams, hybrids, and many latex builds) pairs with an adjustable base, see the <a href="/collections/adjustable-beds">adjustable beds collection</a>. The base replaces the foundation entirely; no box spring needed. Free white-glove delivery and assembly across <a href="${SHOWROOMS_HREF}">Los Angeles</a>.</p>`,
    ].join('\n');
  }

  // ── Size collections ─────────────────────────────────────────
  // Order matters: "california king" before bare "king"; "split king" too.
  if (h.includes('california') || h.includes('cal-king') || h.includes('cal king')) {
    return sizeBlock({
      size: 'California King',
      inches: '72" × 84"',
      feet: '6 ft × 7 ft',
      bestFor:
        'It\'s 4" longer than a standard King but 4" narrower, the right pick for taller sleepers (over 6 ft) and long-narrow bedrooms where the extra length matters more than the extra width.',
      pairsWith:
        'Cal King bedding is its own size and runs slightly more expensive than King bedding because of lower demand. Most adjustable bases offer Cal King as a single-piece unit or as Split Cal King (two 36" × 84" halves) for couples with different sleep needs. See our <a href="/collections/adjustable-beds">adjustable beds collection</a> for compatible bases.',
      roomNote:
        'Minimum bedroom for a Cal King is 12 × 14 ft, the bed itself takes 6 × 7 ft and you need ~24" walk-around space on three sides. If your bedroom is wider than long, a standard <a href="/collections/king-size-mattresses">King</a> (76" × 80") fits the geometry better.',
    });
  }
  if (h.includes('split-king') || h.includes('split king')) {
    return sizeBlock({
      size: 'Split King',
      inches: 'Two 38" × 80"',
      feet: 'Two 3 ft 2 in × 6 ft 8 in',
      bestFor:
        'Two Twin XL mattresses side-by-side that occupy the same footprint as a standard King (76" × 80"). The right pick for couples on an adjustable base who want independent head/foot articulation, and for couples with very different firmness preferences (one half plush, the other firm).',
      pairsWith:
        'Adjustable bases, split-king pairs almost exclusively with adjustable bases that have a Split King configuration (two independent platforms under a single headboard). Bedding splits into two: each half takes its own Twin XL fitted sheet, with a single King flat sheet, duvet, or comforter spanning both. King-sized pillows fit two across.',
      roomNote:
        'Same footprint as a regular King (76" × 80") so the minimum bedroom is 12 × 12 ft. The "split" is internal, the two mattresses sit edge-to-edge under the bedding, invisible from outside the bed.',
    });
  }
  if (h.includes('king')) {
    return sizeBlock({
      size: 'King',
      inches: '76" × 80"',
      feet: '6 ft 4 in × 6 ft 8 in',
      bestFor:
        '16" wider than a Queen, same length. The right pick for couples who want shoulder-room, families who co-sleep with kids or pets, and anyone replacing a Queen because "we keep waking each other up." The extra width is the upgrade; the length is the same as a Queen.',
      pairsWith:
        'King-size bedding is standard and widely available, King fitted sheets, flat sheets, duvets, and pillow shams come in every brand. Most adjustable bases offer King as a single-piece unit; couples who want independent articulation should look at <a href="/collections/split-king-mattresses">Split King</a> instead.',
      roomNote:
        'Minimum bedroom for a King is 12 × 12 ft, the bed itself takes 6.3 × 6.7 ft and you need ~24" walk-around space. If you\'re under 12 × 12, a <a href="/collections/queen-size-mattresses">Queen</a> (60" × 80") fits much more comfortably.',
    });
  }
  if (h.includes('queen')) {
    return sizeBlock({
      size: 'Queen',
      inches: '60" × 80"',
      feet: '5 ft × 6 ft 8 in',
      bestFor:
        'The most-purchased mattress size in the US, and the right answer for most couples and most bedrooms. 6" wider than a Full and 5" longer; enough room for two sleepers without dominating the bedroom or requiring oversized bedding.',
      pairsWith:
        'Queen is the largest size most adjustable bases support as a single-piece unit. Bedding is widely stocked at every price point. Queen pairs well with both traditional bed frames and modern platform beds; most LA apartment bedrooms are sized for Queen, not King.',
      roomNote:
        'Minimum bedroom for a Queen is 10 × 10 ft, the bed itself takes 5 × 6.7 ft and you need ~24" walk-around space on at least three sides. Smaller than that, drop down to a <a href="/collections/full-size-mattresses">Full</a> (54" × 75") to keep the room functional.',
    });
  }
  if (h.includes('full') || h.includes('double')) {
    return sizeBlock({
      size: 'Full',
      inches: '54" × 75"',
      feet: '4 ft 6 in × 6 ft 3 in',
      bestFor:
        '16" wider than a Twin, same length. Best for solo sleepers who want elbow room without committing to a Queen-sized bedroom, and for smaller couples in apartments where a Queen won\'t fit. Sometimes called "Double", same mattress, two names.',
      pairsWith:
        'Full-size bedding is widely available at every retailer. Full pairs with most platform frames, traditional bed frames, and box-spring foundations. Adjustable bases are less common in Full size; couples who want adjustable usually size up to Queen.',
      roomNote:
        'Minimum bedroom for a Full is 9 × 10 ft. Smaller than that, a <a href="/collections/twin-size-mattresses">Twin</a> (38" × 75") is the only way to keep walk-around space.',
    });
  }
  if (h.includes('twin-xl') || h.includes('twin xl')) {
    return sizeBlock({
      size: 'Twin XL',
      inches: '38" × 80"',
      feet: '3 ft 2 in × 6 ft 8 in',
      bestFor:
        'Same width as a Twin (38") but 5" longer. The standard college-dorm size, most universities spec Twin XL frames, and the right pick for tall single sleepers (over 5\'6") who outgrow standard Twin length.',
      pairsWith:
        'Two Twin XL mattresses side-by-side equal a Split King (the right adjustable-base setup for couples with very different sleep preferences, see <a href="/collections/split-king-mattresses">Split King</a>). Twin XL bedding is harder to find at general retailers; we stock fitted sheets and protectors specifically sized for it.',
      roomNote:
        'Minimum bedroom is 7 × 10 ft, same width as a Twin so the room footprint barely changes. The 5" of extra length is the only difference.',
    });
  }
  if (h.includes('twin')) {
    return sizeBlock({
      size: 'Twin',
      inches: '38" × 75"',
      feet: '3 ft 2 in × 6 ft 3 in',
      bestFor:
        'The smallest standard mattress size, the right pick for kids upgrading from a toddler bed, single adults in studio apartments or small bedrooms, guest rooms, and bunk-bed lower or upper bunks. Pairs with most kids-room frames at standard heights.',
      pairsWith:
        'Twin-size bedding is widely available and the cheapest of any size. Trundle beds, bunk beds, and platform frames are all designed around Twin dimensions. For taller single sleepers (over 5\'6"), <a href="/collections/twin-xl-mattress-sale">Twin XL</a> (38" × 80") gives 5" of extra length at the same width.',
      roomNote:
        'Minimum bedroom is 7 × 10 ft, Twin is the only size that fits comfortably in a small bedroom. Below 7 × 10, the bed becomes the entire usable floor of the room.',
    });
  }

  // ── Sale / clearance ─────────────────────────────────────────
  if (h.includes('sale') || h.includes('clearance') || h.includes('floor-model')) {
    return [
      `<p>Our <strong>mattress sales</strong> rotate weekly across memory foam, hybrid, innerspring, and latex builds, same-day delivery available on most in-stock orders, with full warranty coverage even at sale pricing. The discount comes from inventory rotation, floor-model swaps, and brand promos; the mattress itself is new (or, on floor models, lightly demo\'d with a 120-night exchange just like a new build).</p>`,
      `<p><strong>What goes on sale and why.</strong> Brand promos (Tempur-Pedic, Stearns & Foster, Helix, Diamond run quarterly sales that we honor, sometimes deeper); seasonal markdowns (Memorial Day, July 4th, Labor Day, Black Friday, Boxing Week, the calendar follows the rest of US retail); and floor-model swaps when a new model lands or a current one ages out of the lineup.</p>`,
      `<p><strong>How financing works at sale pricing.</strong> 0% APR financing through Synchrony or Acima applies on purchases of $1,500 or more, including sale-priced mattresses. The sale discount and the financing terms are independent; you get both.</p>`,
      `<p>Free white-glove delivery on every sale order across <a href="${SHOWROOMS_HREF}">Los Angeles</a>, including setup and haul-away of your old mattress. Need help picking? Take the <a href="${SLEEP_QUIZ_HREF}">2-minute sleep quiz</a> for a category recommendation, then call any showroom to confirm the sale-eligible model that matches.</p>`,
    ].join('\n');
  }

  // ── Bed-in-a-box ──────────────────────────────────────────────
  if (h.includes('box') && h.includes('bed')) {
    return [
      `<p>Bed-in-a-box mattresses are compressed, rolled, and shipped in a box, the same beds you\'d find on a showroom floor, just delivered via FedEx or freight rather than white-glove. The format started as a DTC mattress-shipping innovation around 2012 and now spans every major brand, every material, and every price tier.</p>`,
      `<p><strong>What changes inside the box vs. on the floor.</strong> Nothing about the mattress itself, same materials, same construction, same warranty. The compression process is mechanically intense (industrial vacuum + roller) but the foam and coil layers are designed to decompress fully within 24-72 hours of opening, with most builds usable the same evening.</p>`,
      `<p><strong>Setup.</strong> Unbox into the room where you want the bed (a box compressed mattress is heavy, 80-140 lbs depending on size). Place on your foundation, cut the plastic, unroll, and walk away. The off-gassing smell from compressed foam dissipates within 12-48 hours; most modern builds use low-VOC CertiPUR-US foams that off-gas minimally.</p>`,
      `<p><strong>Where we still recommend white-glove instead.</strong> Heavier mattresses (hybrids over 100 lbs, all-coil innersprings, hand-tufted luxury models), tight stairway access, or shoppers who want setup + old-mattress haul-away. Our free white-glove option across <a href="${SHOWROOMS_HREF}">Los Angeles</a> includes all of that on most beds. See the <a href="/collections/mattresses">full mattress catalog</a> for every brand and build.</p>`,
    ].join('\n');
  }

  // ── Pain / use-case ──────────────────────────────────────────
  if (h.includes('back-pain') || h.includes('back pain')) {
    return [
      `<p>The right mattress for back pain isn\'t about "firm enough to support", the actual research on chronic back pain and sleep surfaces (notably the 2003 Kovacs et al. study and the 2015 Jacobson follow-up) found that <strong>medium-firm</strong> mattresses produce the lowest pain scores and the best sleep quality across most patient populations. Too firm OR too soft makes back pain worse.</p>`,
      `<p><strong>What "medium-firm" means in practice.</strong> Most modern mattresses rate firmness on a 1-10 scale where 1 is hospital-soft and 10 is plywood-hard. Medium-firm sits at 5.5-7. Brand naming varies, Tempur-Pedic\'s Adapt is 5; ProAdapt Medium is 6; Stearns & Foster\'s Rockwell is 6.5. Test in person; numbers don\'t carry feel.</p>`,
      `<p><strong>How sleep position changes the answer.</strong> Side sleepers with lower back pain often need slightly softer than medium-firm, the lumbar curve has to be cradled, not propped up, when the hips and shoulders sink. Back sleepers do best at standard medium-firm. Stomach sleepers (a smaller share of back-pain shoppers) need firmer to prevent lumbar overextension.</p>`,
      `<p>Pair the right mattress with the right pillow, a side sleeper on a medium-firm bed still gets back pain from a flat pillow that lets the neck hang. See our <a href="/collections/cooling-pillows">cooling pillow collection</a> for thicker side-sleeper lofts. Try the finalists at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a> before committing.</p>`,
    ].join('\n');
  }
  if (h.includes('side-sleeper') || h.includes('side sleeper')) {
    return [
      `<p>Side sleepers need pressure relief at the shoulders and hips, the two points that bear the most weight in a side-lying position. Without it, the joints compress against the mattress and circulation gets pinched, which is why side sleepers often wake up with shoulder, hip, or arm pain on the wrong mattress.</p>`,
      `<p><strong>The right firmness for side sleepers.</strong> Softer than for back or stomach sleepers, typically 4-6 on a 10-point scale (most brands call this "plush" or "medium"). The mattress needs to let the shoulder and hip sink in enough to keep the spine in a straight horizontal line; if you can run a finger between the small of your back and the mattress, the bed is too firm for your sleep position.</p>`,
      `<p><strong>Which materials work best for side sleepers.</strong> Memory foam (deep contouring, best pressure relief at the joints); hybrid with deep foam comfort layers (foam contouring + coil support); and Talalay latex (responsive contouring, won\'t restrict movement in lighter sleepers). Pure innerspring is the worst category for side sleepers, not enough surface contouring without a pillow-top.</p>`,
      `<p>A taller, firmer pillow is critical for side sleepers, the gap between your shoulder and ear is what the pillow has to fill. See our <a href="/collections/cooling-pillows">pillow collection</a> for side-sleeper loft options. Try the mattress at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a> with your own pillow if you can, pillow loft changes how the mattress feels.</p>`,
    ].join('\n');
  }
  if (h.includes('stomach-sleeper') || h.includes('stomach sleeper')) {
    return [
      `<p>Stomach sleepers need a firmer, flatter surface than any other sleep position. When you sleep face-down, your hips are the heaviest point, if they sink into the mattress, your lower back arches into a hammock shape that strains the lumbar spine all night. The fix is a mattress firm enough to keep your hips level with your shoulders, holding the spine in a straight line.</p>`,
      `<p><strong>The right firmness for stomach sleepers.</strong> Firmer than for back or side sleepers, typically 7-8 on a 10-point scale (most brands call this "firm"). The goal is minimal hip sink: you want to lie on top of the mattress, not in it. If you can feel your lower back arching or you wake with lumbar ache, the bed is too soft for your sleep position. This is the one position where "too firm" is rarely the problem.</p>`,
      `<p><strong>Which materials work best for stomach sleepers.</strong> Firm hybrids (a strong pocketed-coil base with a thin comfort layer, coils resist hip sink better than deep foam); firm innerspring (the traditional answer, bouncy, supportive, keeps you on the surface); and firm latex (responsive support that doesn\'t let the hips bottom out). Avoid plush memory foam, the deep contouring that helps side sleepers is exactly what lets a stomach sleeper\'s hips sink and the back overextend.</p>`,
      `<p>Pair a firm mattress with a thin, soft pillow, stomach sleepers want 2" of loft or less, or no pillow at all, so the neck isn\'t cranked upward. A tall pillow on a firm bed reintroduces the spinal strain you just solved. Not sure if you\'re truly a stomach sleeper or a combo sleeper who starts face-down? Take the <a href="${SLEEP_QUIZ_HREF}">2-minute sleep quiz</a>, then try the finalists at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a>.</p>`,
    ].join('\n');
  }
  if (h.includes('heavy') || h.includes('plus-size') || h.includes('plus size') || h.includes('big-and-tall')) {
    return [
      `<p>Heavier sleepers, and we mean this without judgment, it\'s a real engineering difference, need a mattress built to carry more weight without bottoming out, sagging early, or trapping heat. A bed that feels supportive to a 150-lb sleeper can compress fully under a 250-lb sleeper, putting them on the hard base layer with no pressure relief left. The construction has to be specified for the load.</p>`,
      `<p><strong>What to look for at 230+ lb.</strong> A reinforced pocketed-coil unit (more coils, thicker-gauge steel, often a perimeter of firmer coils for edge support); high-density foam comfort layers (1.8 lb/ft³ and up, low-density foam crushes and develops body impressions within a year under heavier loads); and a total height of 12-14 inches or more, so there\'s enough material between you and the foundation. Strong edge support matters more here too, it\'s what lets you sit and sleep near the edge without rolling off.</p>`,
      `<p><strong>Which materials hold up best.</strong> Hybrids are the strongest pick, the coil base does the heavy lifting (literally) while the foam contours, and coils resist sag far better than all-foam at higher weights. Firm latex is the most durable single material we sell and handles weight well. All-foam works only at higher densities; skip budget all-foam builds, which compress fastest. For couples with a large weight gap between partners, a pocketed-coil hybrid keeps the lighter sleeper from rolling toward the heavier one.</p>`,
      `<p><strong>Firmness and durability.</strong> Heavier sleepers generally want medium-firm to firm, the same comfort layer feels softer under more weight, so a mattress that reads "firm" on the floor often sleeps "medium" for a heavier body. Look for the longest warranties and check the sag-depth threshold (the warranty\'s definition of a covered defect). Take the <a href="${SLEEP_QUIZ_HREF}">2-minute sleep quiz</a> for a build matched to your weight and sleep position, then test edge support and sink in person at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a>.</p>`,
    ].join('\n');
  }
  if (h.includes('couple')) {
    return [
      `<p>Couples need a mattress that handles two sets of sleep needs, motion isolation so a thrasher doesn\'t wake their partner; supportive enough that a heavier sleeper doesn\'t sink toward their lighter partner; and big enough that nobody loses elbow room. Size matters as much as material for couples.</p>`,
      `<p><strong>Start with size.</strong> Queen (60" × 80") works for most couples; King (76" × 80") is the upgrade for couples who want shoulder-room or co-sleep with kids/pets. If you\'re replacing a Queen because "we keep waking each other up," the issue is usually motion transfer, not size, see the material section below before sizing up. Cal King is the same width as Queen but 4" longer; pick if either sleeper is tall.</p>`,
      `<p><strong>Material matters for motion isolation.</strong> Memory foam isolates motion better than any other category, a partner can move and you barely feel it. Hybrids isolate well too (pocketed coils + foam comfort). Innersprings transfer the most motion; avoid if one of you moves a lot. Latex is in the middle (some motion transfer, less than coil, more than foam).</p>`,
      `<p><strong>Firmness when partners disagree.</strong> Most couples can agree on a medium-firm; deeper preference splits get solved with a <a href="/collections/split-king-mattresses">Split King</a>, two Twin XL mattresses side-by-side under a single bedding setup, with each half independently chosen for firmness and adjustable-base articulation. Free white-glove delivery on Split King setups across <a href="${SHOWROOMS_HREF}">Los Angeles</a>.</p>`,
    ].join('\n');
  }

  // ── Generic "mattresses" catch-all ───────────────────────────
  if (h === 'mattresses' || h.includes('all-mattress')) {
    return [
      `<p>Every mattress LA Mattress stocks is in this catalog, 100+ models across foam, hybrid, innerspring, and latex from Tempur-Pedic, Stearns & Foster, Helix, Diamond, Sealy, Englander, Eastman House, Southerland, Spring Air, and our private-label LA Mattress collections. Every size, every firmness, every price tier.</p>`,
      `<p><strong>How to narrow down.</strong> Three filters work for most shoppers. First, sleep position: side sleepers want softer + more contouring; back and stomach sleepers want firmer + flatter. Second, material: memory foam (contouring, motion-isolating, runs warm); hybrid (the universally-comfortable middle); innerspring (bouncy, supportive, less motion isolation); latex (responsive, cool, longest-lasting). Third, budget, sales rotate weekly so the same model may sit at three different prices in a month.</p>`,
      `<p><strong>Where the shortlist comes from.</strong> Take the <a href="${SLEEP_QUIZ_HREF}">2-minute sleep quiz</a> for a category recommendation based on sleep position, body weight, and partner needs, it points you at a material and firmness range, and surfaces 3-4 specific models within that range. Or browse by size: <a href="/collections/twin-size-mattresses">Twin</a>, <a href="/collections/full-size-mattresses">Full</a>, <a href="/collections/queen-size-mattresses">Queen</a>, <a href="/collections/king-size-mattresses">King</a>, <a href="/collections/california-king-mattresses">Cal King</a>, <a href="/collections/split-king-mattresses">Split King</a>.</p>`,
      `<p><strong>Always free in LA.</strong> White-glove delivery on every mattress, same-day setup on most in-stock orders, 0% APR financing on purchases of $1,500+, and the 120-night Love Your Bed Guarantee, sleep on it for at least 30 days, then if it isn\'t right, swap firmness with no restocking fee. Try every brand on the floor at any of our <a href="${SHOWROOMS_HREF}">5 LA showrooms</a> before you commit.</p>`,
    ].join('\n');
  }

  // No match — return empty; caller renders just the FAQ + link cluster.
  return '';
}
