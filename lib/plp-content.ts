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
 *   - FAQ is consistent across PLPs but distinct from HOMEPAGE_FAQ in
 *     lib/faq.ts so the two pages don't trigger duplicate-content flags.
 *   - All copy reflects merchant-confirmed facts from Phase 239
 *     (4 PM cutoff, $499 free-delivery threshold, anywhere in LA,
 *     Synchrony + Acima financing).
 */

import type { FaqItem } from './faq';

export const PLP_FAQ: FaqItem[] = [
  {
    q: 'Can I try these mattresses in person before I buy?',
    a: 'Yes. Every model on this page is on the floor at one of our 5 LA showrooms — Koreatown, West LA, La Brea, Studio City, and Glendale. No appointment needed. Lie down on it for as long as you want.',
  },
  {
    q: 'How does delivery work?',
    a: 'Free white-glove delivery on orders over $499 anywhere in Los Angeles. Same-day if you order before 4 PM, otherwise next-day. We set up the new mattress, haul away your old one, and recycle it.',
  },
  {
    q: 'What if the mattress isn’t right for me?',
    a: 'We back every purchase with a 120-night Love Your Bed Guarantee. Sleep on it for at least 30 nights to let your body adjust, then if it’s not the right fit, exchange it for any other mattress — we credit the full original price.',
  },
  {
    q: 'Is financing really 0% APR?',
    a: 'Yes. We offer 0% APR financing through Synchrony and Acima on approved credit. Terms vary by purchase amount and partner — apply in 60 seconds at checkout or in any showroom.',
  },
  {
    q: 'How do I know which firmness to choose?',
    a: 'Take our 2-minute sleep quiz at /sleep-quiz — we match firmness to your sleep position, body weight, and any pain points. You can also call any showroom at (213) 984-4654 and talk to a real person.',
  },
  {
    q: 'What sizes do you carry?',
    a: 'Twin, Twin XL, Full, Queen, King, California King, Split King, and Split California King across every brand we stock. Sizing details and room-fit recommendations are at /pages/mattress-sizes.',
  },
];

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
