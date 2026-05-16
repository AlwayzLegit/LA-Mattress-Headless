/**
 * Per-showroom and per-CMS-page FAQ items, emitted as FAQPage JSON-LD on
 * those routes. Phase 277c.
 *
 * Visual UI is unchanged — these FAQs are structured-data only — so they
 * stay short, neighborhood-specific where applicable, and free of HTML so
 * they round-trip through `JSON.stringify` cleanly.
 *
 * Why bother in 2026: Google trimmed FAQ rich-result eligibility in 2023
 * (now mostly government / health), but valid FAQPage schema is still
 * useful for entity understanding (Knowledge Graph), occasionally still
 * surfaces as a rich result on lower-competition queries, and is required
 * by Bing for FAQ snippet eligibility.
 *
 * The home page already emits FAQPage from `lib/faq.ts` — this file
 * extends the coverage to the surfaces we know rank locally:
 *   - 5 showroom pages       → unique Q&As referencing each neighborhood
 *   - /pages/shipping-and-delivery
 *   - /pages/mattress-store-financing
 *   - /pages/mattress-warranty
 *
 * Each FaqItem stays free of HTML for the same reason as lib/faq.ts.
 */

import type { FaqItem } from './faq';
import type { Showroom } from './showrooms';
import { SITE_PHONE_DISPLAY } from './site-config';

/**
 * Per-showroom FAQs. Q&As are templated from the showroom's neighborhood,
 * street, and hours so each of the 5 pages emits genuinely unique content
 * (Semrush flagged "Duplicate content in h1 and title" on 129 pages of
 * the legacy crawl; identical FAQ blocks across showrooms would create
 * a similar "near-duplicate body" footprint at scale).
 */
export function getShowroomFaq(showroom: Showroom): FaqItem[] {
  const todayHours = showroom.hours[0]
    ? `${showroom.hours[0].open}–${showroom.hours[0].close}`
    : '10am–7pm';
  const intersectionish = showroom.street;
  return [
    {
      q: `Where is the ${showroom.area} mattress store?`,
      a: `Our ${showroom.area} showroom is at ${intersectionish}, ${showroom.city}, ${showroom.region} ${showroom.postalCode}. Free parking on site or street parking nearby.`,
    },
    {
      q: `What are the ${showroom.area} showroom hours?`,
      a: `Mon–Fri ${todayHours}. Weekend hours vary slightly — see the hours table on this page. Call ${SITE_PHONE_DISPLAY} to confirm holiday hours.`,
    },
    {
      q: `Do I need an appointment to visit the ${showroom.area} mattress store?`,
      a: `No — walk-ins are welcome anytime during open hours. Every mattress on the showroom floor is available to try. If you'd like a dedicated sleep consultant for a 30-minute fitting, call ${SITE_PHONE_DISPLAY} and we'll book you in.`,
    },
    {
      q: `Does the ${showroom.area} mattress store deliver same-day?`,
      a: `Yes — order by 4pm at the ${showroom.area} showroom for same-day white-glove delivery anywhere in Los Angeles. Free on orders over $499, with setup and old-mattress haul-away included.`,
    },
    {
      q: `What mattress brands are at the ${showroom.area} showroom?`,
      a: `Tempur-Pedic, Stearns & Foster, Sealy, Diamond, Spring Air, Englander, Eclipse, Helix, and our private-label collections. Most popular models stay on the floor year-round so you can try them in person.`,
    },
    {
      q: `Can I finance a mattress at the ${showroom.area} store?`,
      a: `Yes — 0% APR financing through Synchrony and Acima on approved credit. Apply in-store or online; approvals usually take under a minute. Terms vary by purchase amount and partner.`,
    },
  ];
}

/**
 * Per-CMS-page FAQs, keyed by Shopify page handle. Returns null when the
 * handle has no FAQ set (most CMS pages don't need one). Add entries here
 * — and the DefaultPage template will pick them up automatically without
 * any further wiring.
 */
const CMS_PAGE_FAQS: Record<string, FaqItem[]> = {
  'shipping-and-delivery': [
    {
      q: 'Is mattress delivery free in Los Angeles?',
      a: 'Yes — free white-glove delivery anywhere in LA on orders over $499. Includes setup of your new mattress and free haul-away of your old one. Same-day available when you order by 4pm.',
    },
    {
      q: 'How fast can you deliver a mattress in Los Angeles?',
      a: 'Same-day across LA when you order before 4pm. Otherwise, next-day delivery is standard. Specific delivery windows are confirmed by phone after order.',
    },
    {
      q: 'Do you deliver outside Los Angeles?',
      a: 'Yes — we deliver to most of Southern California (LA County, Orange County, Ventura County, parts of San Bernardino and Riverside). Delivery is still free on orders over $499 within a 50-mile radius of our Studio City showroom. Outside that range, a flat-rate delivery fee applies — call (800) 218-3578 for a quote.',
    },
    {
      q: 'What does "white-glove delivery" include?',
      a: 'Our two-person delivery team brings the mattress into your bedroom, sets it up on your existing bed frame or foundation, takes away packaging, and (free) removes your old mattress for recycling. You don\'t lift anything.',
    },
    {
      q: 'Will you remove my old mattress for free?',
      a: 'Yes — included on every white-glove delivery. We recycle responsibly through partners that strip the mattress to its components (steel, foam, fabric) so it doesn\'t end up in a landfill.',
    },
    {
      q: 'Can I pick up a mattress in-store instead?',
      a: 'Yes — in-store pickup is available at all 5 showrooms (Koreatown, Studio City, Glendale, West LA, and our other locations). Bring a vehicle that can carry the mattress lying flat; we\'ll help you load it.',
    },
  ],
  'mattress-store-financing': [
    {
      q: 'Do you offer 0% APR mattress financing?',
      a: 'Yes — 0% APR through Synchrony and Acima on approved credit. Terms commonly run 12–36 months at 0% APR depending on purchase amount and partner. Longer terms with extended financing are also available.',
    },
    {
      q: 'How do I apply for mattress financing?',
      a: 'Apply at any of our 5 LA showrooms or at checkout online. Approvals take under a minute and don\'t require a hard pull on your credit. Bring a valid ID and a Social Security number; that\'s the minimum.',
    },
    {
      q: 'What credit score do I need to finance a mattress?',
      a: 'Synchrony typically approves at FICO 640+; Acima has a lease-to-own option that does not use a traditional credit pull and approves a wider range of customers. We work with both so most applicants leave with a working financing plan.',
    },
    {
      q: 'Is there a down payment for mattress financing?',
      a: 'Synchrony 0% APR: no down payment required for approved buyers. Acima lease-to-own: a small initial payment (typically $50–$150) is required to start the contract.',
    },
    {
      q: 'Can I finance just a mattress, or do I need to add a bed frame?',
      a: 'You can finance any combination — a mattress alone, a complete bedroom set, or a mattress + bed frame + pillows + sheets. Minimum financed amount is $499 at most showrooms.',
    },
  ],
  'mattress-warranty': [
    {
      q: 'How long is the mattress warranty?',
      a: 'Most premium mattresses we carry (Tempur-Pedic, Stearns & Foster, Diamond, Sealy) include a 10-year limited manufacturer warranty. Some private-label models offer 5 years. The exact terms are in the warranty card delivered with each mattress.',
    },
    {
      q: 'What does the mattress warranty cover?',
      a: 'Body impressions deeper than the manufacturer\'s threshold (typically 0.75″–1.5″), broken coils or springs, and seam or stitching defects under normal use. The warranty does NOT cover comfort preference, normal softening, or stains.',
    },
    {
      q: 'How do I file a warranty claim?',
      a: 'Call (800) 218-3578 or email orders.lamattress@gmail.com with your invoice number and photos of the issue. We coordinate the inspection (often done at home or via photos) and submit the claim to the manufacturer on your behalf.',
    },
    {
      q: 'Is the warranty void if I rotate or don\'t rotate the mattress?',
      a: 'Most no-flip mattresses (which is nearly all modern mattresses) require quarterly rotation — head-to-foot — for the warranty to remain valid. Check the warranty card; we\'ll show you the rotation cadence at delivery.',
    },
    {
      q: 'Do I need to use a specific bed frame to keep the warranty valid?',
      a: 'Yes for most brands — typically a rigid foundation or a slatted frame with slats no more than 3″ apart (so the mattress is fully supported). Adjustable bases are warranty-compatible with most modern mattresses; box springs with sagging are not. Ask in-store and we\'ll match a compatible foundation.',
    },
    {
      q: 'Does the warranty cover stains or damage?',
      a: 'No — stains, burns, tears, or damage from misuse are not covered, and a stained mattress will be denied for inspection. Use a mattress protector from day one to keep the warranty valid.',
    },
  ],
};

export function getCmsPageFaq(handle: string): FaqItem[] | null {
  return CMS_PAGE_FAQS[handle] ?? null;
}
