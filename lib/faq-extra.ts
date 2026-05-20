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
 *   - /pages/mattress-store-delivery
 *   - /pages/mattress-store-financing
 *   - /pages/love-your-bed-guarantee
 *   - /pages/warranty (canonical handle; legacy `/pages/mattress-warranty` 301s here)
 *   - /pages/mattress-recycling-fee
 *   - /pages/mattress-store-contact
 *   - /pages/mattress-firm-vs-la-mattress-store
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
  'mattress-store-delivery': [
    {
      q: 'Is mattress delivery actually free in Los Angeles?',
      a: 'Yes — free on every order over $499 across the LA service area. That covers the mattress, white-glove delivery to your bedroom (not the curb), full setup on your existing frame or base, and haul-away of your old mattress. Orders under $499 incur a flat delivery fee, quoted at checkout.',
    },
    {
      q: 'How fast can I get a mattress delivered in LA?',
      a: 'Most in-stock mattresses ordered by 4 PM are delivered the same day. Saturdays and post-sale weekdays can slip to next-day depending on route density. Custom-order mattresses (handcrafted Chattam & Wells, special-order Stearns & Foster Reserve) take 1–3 weeks to build before delivery.',
    },
    {
      q: 'Do you take away my old mattress for free?',
      a: 'Yes — old mattress haul-away is included free with every white-glove delivery. We wrap your old mattress, load it on our truck, and recycle it through California\'s mattress recycling program. No need to bag it or move it.',
    },
    {
      q: 'Can you deliver to a 2nd-floor apartment with no elevator?',
      a: 'Yes, no extra charge. Just flag the floor count when you order so we can plan. We carry mattresses up to fourth-floor walk-ups in LA apartment buildings every week.',
    },
    {
      q: 'Will you set up the mattress on my bed frame?',
      a: 'Yes — full setup on your existing frame, foundation, or adjustable base is included. We unbox, position the mattress, and check that everything sits flat before we leave. Adjustable bases are also fully assembled and tested.',
    },
    {
      q: 'What if I\'m not home when you arrive?',
      a: 'You\'ll get a 30-minute heads-up text from the driver. If something comes up, call us and we\'ll reschedule the same day, push to the next available window, or coordinate with your doorman or building manager. We don\'t leave mattresses unattended at the door.',
    },
  ],
  'love-your-bed-guarantee': [
    {
      q: 'How long is the comfort exchange window?',
      a: '120 nights from delivery. Sleep on your new mattress for at least 30 nights — give your body time to adjust — then if it\'s not right, contact us anytime within 120 nights to start an exchange. One free exchange per purchase.',
    },
    {
      q: 'What\'s the minimum sleep period before I can exchange?',
      a: '30 nights. A new mattress needs time to break in and your body needs time to adjust — most exchange decisions made in the first two weeks reverse themselves by week four. We hold customers to the 30-night minimum because it leads to better outcomes.',
    },
    {
      q: 'Can I exchange more than once?',
      a: 'The Love Your Bed Guarantee covers one exchange per purchase. If the second mattress isn\'t right either, contact us — we\'ll work with you, but it\'s case-by-case rather than a blanket guarantee. Try mattresses in-store or take the 2-minute sleep quiz first to narrow the field.',
    },
    {
      q: 'What if the replacement costs more or less than the original?',
      a: 'You pay the difference (if more) or we refund the difference (if less). If you used financing, the new balance gets applied to the existing loan at the same terms — no second application, no second credit check.',
    },
    {
      q: 'Are there any restocking fees or return shipping costs?',
      a: 'None. No restocking fees, no shipping costs, no haggling. We pick up the original mattress and deliver + set up the replacement as one appointment, included white-glove logistics.',
    },
    {
      q: 'Does the guarantee apply to floor samples or clearance items?',
      a: 'No. Floor samples and "as-is" clearance items are priced lower precisely because the comfort exchange has been waived. The product page and your receipt both flag the exchange status before checkout.',
    },
    {
      q: 'What if my mattress has a defect rather than a comfort issue?',
      a: 'Manufacturer defects (sagging beyond manufacturer thresholds, broken coils, foam delamination) are covered separately by the brand\'s warranty — typically 10 years. We help you file the claim. The comfort exchange is for "this isn\'t my body\'s right feel"; the manufacturer warranty is for "this is broken."',
    },
  ],
  'warranty': [
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
  'mattress-recycling-fee': [
    {
      q: 'What is the California mattress recycling fee?',
      a: 'California State Law requires retailers to collect a per-piece recycling fee on every mattress, box spring, foundation, and adjustable base sold. The fee funds the state\'s mattress recycling program (administered by the Mattress Recycling Council) and is set by the state — not by individual retailers.',
    },
    {
      q: 'How much is the recycling fee per piece?',
      a: 'The fee is per piece — mattress, box spring, foundation, and adjustable-base components each carry the fee. The exact amount is set by California\'s Mattress Recycling Council and is itemized at checkout. Check the live total before placing your order; it\'s a separate line from the mattress price.',
    },
    {
      q: 'Why do I have to pay the fee if I am not recycling my old mattress?',
      a: 'State law requires retailers to collect the fee on every new mattress sold, regardless of what you do with your old one. The fee funds the statewide recycling infrastructure (drop-off centers, transport, processing facilities) that every California resident can use at no additional cost when they\'re ready to recycle.',
    },
    {
      q: 'Does LA Mattress Store take my old mattress for recycling?',
      a: 'Yes — every white-glove delivery includes free pickup and recycling of your old mattress, regardless of where you bought it. We wrap it, load it, and route it through the state\'s recycling program. No need to pre-arrange or pay extra.',
    },
    {
      q: 'What if I recycle the old mattress myself?',
      a: 'You still pay the state-mandated recycling fee at purchase (it\'s collected on the sale, not on the disposal). You may receive a modest incentive from the Mattress Recycling Council if you drop off your used mattress at a designated state-approved location.',
    },
    {
      q: 'What happens to the recycled mattress?',
      a: 'The mattresses are dismantled and the steel, foam, fabric, and wood are separated and reused to make new products. About 75% of a typical mattress is recyclable. Learn more at mattressrecyclingcouncil.org/mrc-in-your-state/california.',
    },
  ],
  'mattress-store-contact': [
    {
      q: 'How can I contact LA Mattress Store?',
      a: 'Three ways: call (800) 218-3578 between 10 AM and 8 PM Pacific, email orders.lamattress@gmail.com (we reply within one business day), or visit any of our 5 LA showrooms during open hours. No appointment needed.',
    },
    {
      q: 'What are your business hours?',
      a: 'All 5 LA showrooms are open daily — typically Mon–Fri 10 AM–9 PM, Sat–Sun 10 AM–8 PM. Each showroom\'s exact hours vary slightly; see the per-showroom page for current times.',
    },
    {
      q: 'How quickly do you respond to emails?',
      a: 'Within one business day, usually within a few hours during business hours. For urgent orders or delivery questions, calling is faster — our phone line is staffed 10 AM–8 PM Pacific seven days a week.',
    },
    {
      q: 'Can I chat with a sales expert live?',
      a: 'Yes — live chat is available on the website during business hours (10 AM–8 PM Pacific). Click the chat icon in the lower-right corner of any page. A real mattress consultant — not a bot — replies within a minute.',
    },
    {
      q: 'Do you have a showroom near me?',
      a: 'Five LA showrooms: Koreatown, West LA, La Brea / Hancock Park, Studio City, and Glendale. We deliver white-glove to all of LA County. Check the Locations page for hours, directions, and the closest showroom to your zip code.',
    },
    {
      q: 'How do I apply for a job at LA Mattress Store?',
      a: 'Email your resume to orders.lamattress@gmail.com with "Career" in the subject line. We hire showroom sales consultants (salaried, never commission), delivery drivers, and customer service team members. Check our Careers page for current openings.',
    },
  ],
  'mattress-firm-vs-la-mattress-store': [
    {
      q: 'What is the difference between LA Mattress Store and Mattress Firm?',
      a: 'LA Mattress Store is family-owned, LA-based since 2012, with 5 local showrooms and salaried (non-commission) consultants. Mattress Firm is a national chain with commission-based sales reps and 2,200+ stores. The biggest practical differences for LA shoppers are local stock (we keep most mattresses on the floor), free same-day white-glove delivery within LA, and no upsell pressure.',
    },
    {
      q: 'Who has better prices — LA Mattress or Mattress Firm?',
      a: 'Both run promotional pricing year-round, but our Low Price Guarantee means we beat any authorized retailer\'s advertised price by 10% on the same model. For Tempur-Pedic, Stearns & Foster, and Sealy specifically, the MSRP is brand-controlled — so the real differentiator becomes delivery cost, financing terms, and what\'s actually in stock today.',
    },
    {
      q: 'How does delivery compare?',
      a: 'LA Mattress: free white-glove delivery anywhere in LA on orders over $499 — typically same-day if ordered by 4 PM, with mattress setup on your bed frame and free haul-away of the old mattress. Mattress Firm: free standard delivery on most orders over $250, with same-day available in some markets; haul-away is sometimes a separate charge.',
    },
    {
      q: 'Do you carry the same mattress brands as Mattress Firm?',
      a: 'We carry most of the same major brands — Tempur-Pedic, Stearns & Foster, Sealy, Chattam & Wells, Spring Air, Englander, Diamond, Helix, Harvest — plus several brands Mattress Firm doesn\'t (regional and direct-to-consumer brands). Brand availability on the floor is consistent year-round at our showrooms; check the brands page for the current lineup.',
    },
    {
      q: 'Is the financing the same?',
      a: '0% APR on approved credit at both stores. LA Mattress Store uses Synchrony and Acima (Acima offers a soft-credit-pull lease-to-own path for thin-credit buyers). Mattress Firm uses Synchrony and Progressive Leasing on a similar structure. Promotional 0% term lengths are tied to your purchase amount at both.',
    },
    {
      q: 'Does LA Mattress Store offer a comfort exchange like Mattress Firm?',
      a: 'Yes — our Love Your Bed Guarantee is a 120-night comfort exchange (sleep on it 30+ nights, swap for any other mattress in stock if it isn\'t right, no restocking fee). Mattress Firm\'s 120 Night Sleep Trial is similar, with a comparable 21-day minimum and a per-policy $99.99 redelivery fee for the swap. The trial windows match; the swap logistics are where the practical difference lives.',
    },
    {
      q: 'Which is better for LA shoppers — LA Mattress or Mattress Firm?',
      a: 'If you live in LA and want a mattress today (same-day delivery, setup, haul-away, locally-owned support after the sale), LA Mattress Store is the more practical choice. If you\'re shopping outside LA or want a specific Mattress Firm-exclusive model (e.g. Sleepy\'s house brand), Mattress Firm makes sense. The actual mattress you sleep on matters more than the storefront — try both if you can, take advantage of the comfort exchange, and pick the bed your body agrees with.',
    },
  ],
};

export function getCmsPageFaq(handle: string): FaqItem[] | null {
  return CMS_PAGE_FAQS[handle] ?? null;
}
