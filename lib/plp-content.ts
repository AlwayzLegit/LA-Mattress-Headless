/**
 * PLP content block — category-aware intro paragraph + FAQ that renders
 * below the product grid on every /collections/[handle] route.
 *
 * Why it exists (Phase 265): the May SEMrush audit flagged 941 PLPs for
 * "Low text-to-HTML ratio" — the product grid is markup-heavy but
 * text-light, and most collections don't have merchant-authored
 * descriptions in Shopify. Surfacing structured shopping copy +
 * questions/answers per category gives both crawlers something to index
 * and shoppers more help below the grid (most don't read it, but the
 * ones who do convert better).
 *
 * Content discipline:
 *   - Intros vary by collection handle (memory-foam vs hybrid vs latex
 *     vs innerspring vs brand-specific) so PLPs aren't pure boilerplate.
 *   - Phase 276: FAQ ALSO varies by collection — each category gets its
 *     own 3-question Q&A specific to that material/brand, plus the same
 *     3 universal shopping questions (delivery / guarantee / financing)
 *     that apply to every PLP. Category-specific Qs make each PLP's
 *     FAQPage JSON-LD eligible for featured-snippet matches specific to
 *     that category (e.g., "memory foam mattress hot" → memory-foam PLP).
 *   - All copy reflects merchant-confirmed facts from Phase 239
 *     (4 PM cutoff, $499 free-delivery threshold, anywhere in LA,
 *     Synchrony + Acima financing).
 */

import type { FaqItem } from './faq';

/**
 * 3 universal shopping questions that apply to every category. These
 * appear at the END of every PLP's FAQ list, after the category-specific
 * Qs above them.
 */
const UNIVERSAL_FAQ: FaqItem[] = [
  {
    q: 'How does delivery work?',
    a: 'Free white-glove delivery on orders over $499 anywhere in Los Angeles. Same-day if you order before 4 PM, otherwise next-day. We set up the new mattress, haul away your old one, and recycle it — not landfill.',
  },
  {
    q: 'What if the mattress isn’t right for me?',
    a: 'We back every purchase with a 120-night Love Your Bed Guarantee. Sleep on it for at least 30 nights to let your body adjust, then if it’s not the right fit, exchange it for any other mattress — we credit the full original price.',
  },
  {
    q: 'Is financing really 0% APR?',
    a: 'Yes. We offer 0% APR financing through Synchrony and Acima on approved credit. Terms vary by purchase amount and partner — apply in 60 seconds at checkout or in any showroom.',
  },
];

const MEMORY_FOAM_FAQ: FaqItem[] = [
  {
    q: 'Will a memory foam mattress sleep hot?',
    a: 'Older memory foam did. Modern memory foam mattresses use gel infusion, copper, open-cell construction, or phase-change covers to dissipate heat — most current models sleep cooler than traditional foam. If you sleep hot, look specifically for "cooling" or "gel-infused" in the description, or consider a hybrid (foam over coils) which breathes more.',
  },
  {
    q: 'Is memory foam good for side sleepers?',
    a: 'Yes — memory foam is typically the best material for side sleepers because it contours around the shoulder and hip, distributing pressure instead of concentrating it where the body curves. Look for a medium to medium-soft firmness; firm foam reduces the pressure-relief benefit that makes the material work for side sleeping.',
  },
  {
    q: 'How long does a memory foam mattress last?',
    a: 'Quality memory foam mattresses last 7–10 years with proper care (rotation every 3–6 months, use of a mattress protector, proper foundation). Premium brands like Tempur-Pedic typically warranty 10 years; some budget foam mattresses degrade faster.',
  },
];

const HYBRID_FAQ: FaqItem[] = [
  {
    q: 'What is a hybrid mattress?',
    a: 'A hybrid combines a pocketed-coil support unit with foam or latex comfort layers on top. You get the contour and pressure relief of foam plus the airflow, edge support, and bounce of innersprings. Most shoppers do well on a hybrid — it’s the most universally comfortable material we carry.',
  },
  {
    q: 'Are hybrid mattresses good for hot sleepers?',
    a: 'Yes — the coil layer creates an airflow channel under the comfort foam, which lets heat escape much better than an all-foam mattress. Hot sleepers usually prefer hybrid or latex over pure memory foam for this reason.',
  },
  {
    q: 'How is a hybrid different from a traditional innerspring?',
    a: 'A traditional innerspring uses a single connected coil unit (Bonnell or continuous-wire) with thin foam or fiber on top. A hybrid uses individually-wrapped pocketed coils that move independently, with substantially deeper comfort layers. Hybrid sleeps quieter, isolates motion better, and contours more closely than an old-style innerspring.',
  },
];

const LATEX_FAQ: FaqItem[] = [
  {
    q: 'Is latex naturally cooling?',
    a: 'Yes — natural latex is one of the most breathable mattress materials available. Its open-cell structure allows airflow, and many latex mattresses use moisture-wicking covers (TENCEL, organic cotton, copper-infused fabric) to enhance cooling further. Latex is our top recommendation for hot sleepers.',
  },
  {
    q: 'How long does a latex mattress last?',
    a: '15–20 years with proper rotation — the longest-lasting mattress material we carry. Natural latex is highly durable and resists body impressions much better than memory foam or innerspring. The longer lifespan often makes latex the most cost-effective mattress over time despite the higher upfront price.',
  },
  {
    q: 'Is natural latex safe? Any chemical concerns?',
    a: 'Natural latex is harvested from rubber trees and is generally considered safe for the vast majority of shoppers. Look for GOLS, GOTS, OEKO-TEX, or CertiPUR-US certifications which confirm low VOC emissions and absence of harmful chemicals. If you have a known latex allergy, talk to your doctor before purchase.',
  },
];

const INNERSPRING_FAQ: FaqItem[] = [
  {
    q: 'Are innerspring mattresses outdated?',
    a: 'Modern innersprings use individually-wrapped pocketed coils, foam-encased edges, and substantial comfort layers — very different from the loud, transfer-prone innersprings of decades past. They remain a strong choice for shoppers who want classic bounce, excellent airflow, and a firmer feel. Brands like Stearns & Foster, Chattam & Wells, and Englander are still primarily innerspring.',
  },
  {
    q: 'Do innerspring mattresses sleep hot?',
    a: 'Innerspring is actually one of the coolest mattress types — the open coil core allows continuous air circulation. Hot sleepers often do better on an innerspring or hybrid than on an all-foam mattress.',
  },
  {
    q: 'What’s the difference between pocketed coils and continuous coils?',
    a: 'Pocketed coils are individually wrapped in fabric and move independently — better motion isolation, more conforming. Continuous (or Bonnell) coils are connected by wire and move as a unit — historically cheaper, more bouncy, less individual support. Almost every quality innerspring we carry today uses pocketed coils.',
  },
];

const TEMPUR_FAQ: FaqItem[] = [
  {
    q: 'Is Tempur-Pedic worth the price?',
    a: 'For shoppers who specifically want the original TEMPUR memory foam feel and a long-term mattress (10+ years), yes. The viscoelastic foam Tempur-Pedic invented contours like nothing else — it’s the gold standard side-by-side. The premium is for the material formulation and the 10-year warranty, not just the brand name.',
  },
  {
    q: 'Does Tempur-Pedic sleep hot?',
    a: 'Older Tempur-Pedic models had heat-retention complaints. The current ProAdapt, LuxeAdapt, and ProBreeze lines all include phase-change cooling covers, gel-infused TEMPUR foam, or active cooling materials. The ProBreeze line specifically targets hot sleepers with up to 10°F cooler sleep claims. Hybrid Tempur-Pedic models (with coils underneath) breathe better than all-foam variants.',
  },
  {
    q: 'How long does a Tempur-Pedic last?',
    a: 'Tempur-Pedic mattresses are warrantied 10 years and typically last 12–15 years with proper care. Their density (the TEMPUR material is denser than typical memory foam) is what drives the longevity — and what justifies the premium.',
  },
];

const STEARNS_FAQ: FaqItem[] = [
  {
    q: 'What makes Stearns & Foster mattresses special?',
    a: 'Stearns & Foster is hand-tufted, hand-built, and uses premium materials like cashmere-blend covers, IntelliCoil pocketed support, and natural-fiber comfort layers. They sit in the luxury innerspring + hybrid tier alongside Aireloom and Hastens. Owned by Sealy, made in the USA.',
  },
  {
    q: 'Are Stearns & Foster mattresses worth it?',
    a: 'For shoppers who want a luxury innerspring/hybrid with hand-craftsmanship and don’t want all-foam, yes. They typically last 12–15 years and feature support technologies (IntelliCoil, advanced edge systems) that outlast cheaper innersprings. The premium pays for material quality and build, not marketing.',
  },
  {
    q: 'What’s the difference between Lux Estate and Reserve collections?',
    a: 'Lux Estate is the mid-luxury tier with hand-tufting and IntelliCoil HD support. Reserve is the top-tier collection — hand-tufted by master craftsmen, cashmere-blend covers, and the deepest pillow-top builds (up to 17 inches). Both come in firm, plush, and Euro-top variants across multiple sizes.',
  },
];

const HELIX_FAQ: FaqItem[] = [
  {
    q: 'What makes Helix Sleep different from other hybrids?',
    a: 'Helix builds to-fit hybrid mattresses with three collection tiers (Core, Luxe, Elite) that step up in coil count, foam density, and cover technology. The Midnight, Twilight, and other model names within each collection indicate firmness profile (e.g., Midnight = medium, Twilight = firm). It’s a more granular firmness selection than most hybrid brands.',
  },
  {
    q: 'How firm are Helix mattresses?',
    a: 'Helix labels firmness clearly per model: medium-soft, medium, medium-firm, firm. Their Midnight series sits at medium; Twilight at firm; Sunset at plush. The 13.5-inch Luxe models are slightly softer-feeling because of the deeper comfort layer; 11.5-inch Core models feel firmer.',
  },
  {
    q: 'Is Helix Sleep good for side sleepers?',
    a: 'Yes — the Midnight (medium) and Midnight Luxe (medium with deeper comfort layer) are particularly good for side sleepers. They contour at the shoulders and hips while the pocketed coils keep the spine aligned. Try both at any of our 5 LA showrooms to compare.',
  },
];

const SOUTHERLAND_FAQ: FaqItem[] = [
  {
    q: 'What is the Scandinavian Collection by Southerland?',
    a: 'Southerland’s Scandinavian Collection is a CertiPUR-US-certified natural latex line built in Minnesota. Natural latex over pocketed coils, with TENCEL and copper-gel covers. Models include the firm Stockholm, the medium Anniversary, and the plush Sandmahn — covering 13–16 inch heights and firm to plush comfort levels.',
  },
  {
    q: 'How long does a Southerland mattress last?',
    a: 'Southerland’s natural-latex Scandinavian Collection mattresses are warrantied 12 years and typically last 15+ years with proper rotation. Latex is the longest-lasting mattress material we carry.',
  },
  {
    q: 'Is the Scandinavian Collection good for hot sleepers?',
    a: 'Yes. The natural latex layer is highly breathable, the pocketed coil core creates an airflow channel, and the TENCEL/copper covers wick moisture. This collection is one of our top recommendations for hot sleepers along with the Harvest Green organic latex line.',
  },
];

const ENGLANDER_FAQ: FaqItem[] = [
  {
    q: 'What makes Englander mattresses different from other innersprings?',
    a: 'Englander is a fourth-generation American mattress maker known for the O’Conner and Allendale luxury innerspring collections. They focus on the $1,500–$2,500 queen tier with advanced cooling covers (Polar Touch) and copper-infused memory foam comfort layers over pocketed coils. Strong value at the entry-luxury price point.',
  },
  {
    q: 'Is Englander made in the USA?',
    a: 'Yes — every Englander mattress is manufactured in the United States by a family-owned company that has been building mattresses since 1894.',
  },
  {
    q: 'Are Englander mattresses good for back sleepers?',
    a: 'Yes — the O’Conner and Allendale firm and luxury-firm Euro-top configurations provide the steady lumbar support back sleepers need, with enough cushioning at the surface to relieve pressure on the shoulders and hips.',
  },
];

const SALE_FAQ: FaqItem[] = [
  {
    q: 'Are the mattresses on the sale page brand new?',
    a: 'Yes. Floor models and clearance mattresses are brand new — they may have been displayed at one of our 5 LA showrooms where shoppers tried them for a few minutes at a time, but they were never slept on. Every clearance mattress ships with the same 120-night Love Your Bed Guarantee as full-price models.',
  },
  {
    q: 'Why are these mattresses discounted?',
    a: 'Mostly because they’re last season’s models or because we’re rotating in newer styles. Brands periodically refresh their lineups and we discount the previous-generation models to clear floor space. The mattresses themselves haven’t changed in quality — just the year on the spec sheet.',
  },
  {
    q: 'Can I see clearance mattresses in person before buying?',
    a: 'Yes — clearance mattresses are typically on the floor at the same showrooms where they were originally displayed. Call the showroom nearest you to confirm availability before driving over: Koreatown (213) 984-4654, West LA (310) 507-8024, La Brea (323) 275-4715, Studio City (818) 247-7790, Glendale (818) 275-6592.',
  },
];

const ADJUSTABLE_FAQ: FaqItem[] = [
  {
    q: 'Will an adjustable base work with my current mattress?',
    a: 'Most modern foam, hybrid, and latex mattresses flex with an adjustable base — that covers nearly everything we sell. Traditional innerspring mattresses with a rigid border are the exception and may not bend safely. If you tell us your mattress model when you order, we will confirm compatibility before delivery; you can also check our mattress types page for which constructions are adjustable-friendly.',
  },
  {
    q: 'What does an adjustable base actually do?',
    a: 'At minimum, independent head and foot elevation — useful for reading, TV, working in bed, easing acid reflux, reducing snoring, and taking pressure off the lower back (the zero-gravity preset is the most-requested setting). Premium bases on this page add wireless remotes, programmable presets, under-bed lighting, USB charging, and massage.',
  },
  {
    q: 'Does an adjustable base replace my box spring?',
    a: 'Yes. An adjustable base replaces your existing foundation or box spring entirely. It works inside most standard bed frames or freestanding on its own legs. Our white-glove delivery includes assembly and free haul-away of your old foundation, so there is nothing to set up yourself.',
  },
];

const PILLOW_FAQ: FaqItem[] = [
  {
    q: 'How do I pick a pillow for my sleep position?',
    a: 'Pillow loft should fill the gap between your neck and the mattress so your spine stays neutral. Side sleepers generally need a higher, firmer pillow; back sleepers a medium loft; stomach sleepers a thin, soft one. Getting this right matters as much for neck and shoulder comfort as the mattress itself — take the 2-minute sleep quiz at /sleep-quiz if you are unsure of your dominant position.',
  },
  {
    q: 'What are these pillows made of?',
    a: 'The pillows on this page span solid memory foam (contouring, supportive), shredded/adjustable foam (you can add or remove fill), natural latex (responsive and cool), down-alternative (soft and plush), and gel-infused cooling foam for hot sleepers. Each product page lists the fill and loft.',
  },
  {
    q: 'How often should a pillow be replaced?',
    a: 'Roughly every 1–3 years depending on material — down-alternative breaks down soonest, memory foam and latex last longest. Quick test: fold the pillow in half; if it stays folded instead of springing back, it has lost support and it is time to replace it.',
  },
];

const GENERIC_FAQ: FaqItem[] = [
  {
    q: 'Can I try these mattresses in person before I buy?',
    a: 'Yes. Every model on this page is on the floor at one of our 5 LA showrooms — Koreatown, West LA, La Brea, Studio City, and Glendale. No appointment needed. Lie down on it for as long as you want.',
  },
  {
    q: 'How do I know which firmness to choose?',
    a: 'Take our 2-minute sleep quiz at /sleep-quiz — we match firmness to your sleep position, body weight, and any pain points. You can also call any showroom at (213) 984-4654 and talk to a real person who fits mattresses for a living.',
  },
  {
    q: 'What sizes are available?',
    a: 'Twin, Twin XL, Full, Queen, King, California King, Split King, and Split California King across every brand we stock. Sizing details and room-fit recommendations are at /pages/mattress-sizes.',
  },
];

/**
 * Phase 276: return a 6-item FAQ that's specific to the collection's
 * category (material or brand). 3 category-specific Qs followed by 3
 * universal shopping Qs (delivery / guarantee / financing).
 *
 * Each PLP gets unique FAQPage JSON-LD eligible for featured-snippet
 * matches on category-specific searches. E.g., "memory foam mattress
 * hot" → memory-foam PLP Q&A. Plus the universal Qs cover the bulk
 * shopping concerns that apply across categories.
 */
export function categoryFaqFor(handle: string): FaqItem[] {
  const h = handle.toLowerCase();

  // Brand-specific (most specific first)
  if (h.includes('tempur')) return [...TEMPUR_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('stearns') && h.includes('foster')) return [...STEARNS_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('helix')) return [...HELIX_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('southerland') || h.includes('scandinavian')) return [...SOUTHERLAND_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('englander')) return [...ENGLANDER_FAQ, ...UNIVERSAL_FAQ];

  // Material-specific
  if (h.includes('memory-foam') || h.includes('foam')) return [...MEMORY_FOAM_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('hybrid')) return [...HYBRID_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('latex')) return [...LATEX_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('innerspring')) return [...INNERSPRING_FAQ, ...UNIVERSAL_FAQ];

  // Accessory categories (adjustable bases, pillows) — were falling
  // through to the generic mattress FAQ, which read wrong on these PLPs
  // (merchant flagged adjustable-beds + pillows).
  if (h.includes('adjustable')) return [...ADJUSTABLE_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('pillow')) return [...PILLOW_FAQ, ...UNIVERSAL_FAQ];

  // Sale / clearance
  if (h.includes('sale') || h.includes('clearance') || h.includes('floor-model')) {
    return [...SALE_FAQ, ...UNIVERSAL_FAQ];
  }

  // Generic mattress fallback
  return [...GENERIC_FAQ, ...UNIVERSAL_FAQ];
}

/**
 * Legacy export kept for backwards compatibility with any callers; the
 * PlpContentBlock now uses categoryFaqFor() instead. Don't add new
 * callers to PLP_FAQ — use the category-aware function.
 */
export const PLP_FAQ: FaqItem[] = [...GENERIC_FAQ, ...UNIVERSAL_FAQ];

/**
 * Return a 2-3 sentence intro paragraph for a collection PLP, varied by
 * the collection handle so each PLP carries unique above-the-fold copy.
 *
 * Strategy: substring-match against the handle (e.g., a handle containing
 * "memory-foam" gets the memory-foam intro). Order matters — more
 * specific patterns first (brand-specific) before generic material
 * matches. Falls back to a generic mattress-shopping intro.
 */
export function categoryIntroFor(handle: string, title: string): string {
  const h = handle.toLowerCase();

  // Brand-specific intros (highest specificity)
  if (h.includes('tempur')) {
    return `Tempur-Pedic uses the original NASA-developed TEMPUR memory foam — the same material the brand has built around for 30+ years. Models range from the all-foam ProAdapt and Adapt collections to the hybrid LuxeAdapt with pocketed coils underneath, so back, side, and combo sleepers all have a fit. Every Tempur-Pedic sold at LA Mattress comes with white-glove delivery and our 120-night Love Your Bed Guarantee.`;
  }
  if (h.includes('stearns') && h.includes('foster')) {
    return `Stearns & Foster is a hand-tufted, hand-built mattress brand owned by Sealy — best known for the Estate and Reserve collections built with IntelliCoil pocketed support and cashmere-blend covers. Most models are 14–17 inches tall with deep pillow-top or Euro-top comfort layers, made for shoppers who want a classic luxury mattress feel. Try them in person at any of our 5 LA showrooms.`;
  }
  if (h.includes('helix')) {
    return `Helix Sleep is a build-to-fit hybrid brand — every model layers individually pocketed coils under foam comfort layers and a knit cover. The Core, Luxe, and Elite collections step up in coil count, foam density, and cover technology so you can match your budget to the level of pressure relief and edge support you want.`;
  }
  if (h.includes('southerland') || h.includes('scandinavian')) {
    return `Southerland's Scandinavian Collection is a CertiPUR-US-certified latex line built in Minnesota — natural latex over a pocketed-coil support unit, with TENCEL and copper-gel covers across the lineup. Latex is the longest-lasting mattress material we stock (15+ year life with proper rotation) and runs cooler than memory foam, which is why we recommend it for hot sleepers.`;
  }
  if (h.includes('englander')) {
    return `Englander is a fourth-generation American mattress builder — best known for the O'Conner and Allendale luxury innerspring lines. Pocketed coils and gel-infused memory foam comfort layers in heights from 14–17 inches, in firm Euro-top and plush box-top builds. Made in the USA.`;
  }

  // Material-specific intros
  if (h.includes('memory-foam') || h.includes('foam')) {
    return `Memory foam contours to your body and isolates motion better than any other mattress type — the ideal choice for side sleepers who want pressure relief at the shoulders and hips, and for anyone who shares a bed with a restless partner. The trade-off is heat retention; we recommend choosing a foam with gel infusion, copper, or open-cell cooling tech if you sleep hot.`;
  }
  if (h.includes('hybrid')) {
    return `Hybrid mattresses combine memory foam or latex comfort layers with a pocketed-coil base for the best of both feel and support. The coils provide breathability and edge stability that pure foam can't match, while the comfort layers give you the contouring foam is known for. Most mattress shoppers do well on a hybrid — it's the most universally comfortable category we carry.`;
  }
  if (h.includes('latex')) {
    return `Latex is the longest-lasting and most breathable mattress material we sell — 15+ year typical life span, with a buoyant, responsive feel that doesn't sink in like memory foam. It's our top recommendation for hot sleepers and shoppers with joint pain. Most latex mattresses are built with natural Talalay or Dunlop latex over a pocketed-coil support layer.`;
  }
  if (h.includes('innerspring')) {
    return `Innerspring mattresses use a steel coil support unit topped with comfort foam, fiber, or pillow-top layers — the most traditional mattress construction, with the bounce and edge support that hybrid and foam mattresses don't replicate. We stock Stearns & Foster, Englander, and Eastman House innerspring builds with pocketed coils for motion isolation and pillow-top or Euro-top comfort layers.`;
  }

  // Accessory categories
  if (h.includes('adjustable')) {
    return `Adjustable bases let you raise your head and feet independently — for reading, working, TV, easing acid reflux and snoring, and taking pressure off the lower back with the zero-gravity preset. The bases on this page replace your existing foundation and pair with nearly every foam, hybrid, and latex mattress we carry. White-glove delivery includes assembly and free haul-away of your old foundation; try the controls in person at any of our 5 LA showrooms.`;
  }
  if (h.includes('pillow')) {
    return `The right pillow keeps your neck and spine aligned with your mattress — loft should match your sleep position (higher and firmer for side sleepers, medium for back, thin for stomach). The pillows on this page range from contouring memory foam and natural latex to adjustable shredded-fill and cooling-gel options for hot sleepers. Free delivery in Los Angeles on qualifying orders.`;
  }

  // Sale / clearance
  if (h.includes('sale') || h.includes('clearance') || h.includes('floor-model')) {
    return `Floor models and clearance mattresses on this page are deeply discounted because they were either display units at one of our 5 LA showrooms or are last season's models. Every clearance mattress is brand new (never slept on except by showroom shoppers trying it out for a few minutes at a time) and ships with the same 120-night Love Your Bed Guarantee and free delivery as full-price models.`;
  }

  // Size-specific
  if (h.includes('queen')) {
    return `Queen-size mattresses (60" × 80") are the most popular size we sell — large enough for two adults, compact enough for most bedrooms. ${title} on this page span every material, firmness, and budget. Free white-glove delivery in Los Angeles on orders over $499.`;
  }
  if (h.includes('king')) {
    return `King-size mattresses (76" × 80") give two adults the most sleeping surface of any standard size. ${title} on this page are stocked across every material, firmness, and budget tier. Free white-glove delivery in Los Angeles on orders over $499.`;
  }
  if (h.includes('twin')) {
    return `Twin-size mattresses are made for guest rooms, kids' rooms, dorms, and bunk beds. ${title} on this page span memory foam, hybrid, and innerspring builds across every firmness. Free white-glove delivery in Los Angeles on orders over $499.`;
  }

  // Generic mattress fallback
  return `Every model on this page is on the floor at one of our 5 LA showrooms — Koreatown, West LA, La Brea, Studio City, and Glendale — so you can try before you buy. Free white-glove delivery on orders over $499 anywhere in Los Angeles, 120-night Love Your Bed Guarantee, and 0% APR financing through Synchrony and Acima.`;
}
