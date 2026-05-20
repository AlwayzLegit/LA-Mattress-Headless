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

// ─────────────────────────────────────────────────────────────────────
// Size-aware FAQ banks (Phase 298). Filling the largest coverage gap —
// queen / king / cal-king / twin / twin-xl / full / split-king PLPs are
// the highest-traffic category collections in the catalog (>500
// products combined) and previously fell through to GENERIC_FAQ. Each
// bank answers the 3 questions shoppers actually type when researching
// a size (dimensions, who-it-fits, sheets/foundation compatibility).
// ─────────────────────────────────────────────────────────────────────

const QUEEN_FAQ: FaqItem[] = [
  {
    q: 'What are the dimensions of a queen mattress?',
    a: 'A standard queen mattress is 60 inches wide by 80 inches long. It comfortably fits one adult with room to spread out, or two adults who don\'t mind sleeping close. We recommend a bedroom at least 10x10 feet to leave walking space around the bed; 12x12 or larger is ideal.',
  },
  {
    q: 'Queen vs full — which should I get?',
    a: 'A queen is 6 inches wider than a full (60" vs 54") and 5 inches longer (80" vs 75"). For couples, queen is the practical minimum — full is too narrow to share comfortably. For a single adult, full works if your room is tight, but queen is worth the upgrade if you have the space and the budget.',
  },
  {
    q: 'Do I need a special foundation for a queen mattress?',
    a: 'A standard queen foundation, box spring, slatted platform bed, or adjustable base all work. Slats should be no more than 3 inches apart for foam and hybrid mattresses, otherwise the warranty may not cover sagging. Our white-glove delivery includes setup on whatever foundation you have, plus free haul-away of the old one.',
  },
];

const KING_FAQ: FaqItem[] = [
  {
    q: 'King vs California king — what\'s the difference?',
    a: 'A standard king is 76" wide by 80" long — the widest mattress made. A California king is narrower but longer at 72" wide by 84" long. King suits couples who want maximum side-to-side space; Cal King suits sleepers 6 feet or taller who need the extra length. Both use king-sized bedding, but the sheets are not interchangeable between the two.',
  },
  {
    q: 'Will a king mattress fit through my doorway and hallway?',
    a: 'Yes. Most of the king mattresses we sell ship rolled-and-compressed in a box, which fits through any standard 30" doorway with room to spare. Traditional non-compressed kings (some luxury innersprings) measure 76" wide flat, but our delivery team handles getting them through tight stairwells and hallways. Call ahead if you have unusually narrow access.',
  },
  {
    q: 'How much room do I need for a king bed?',
    a: 'We recommend a bedroom at least 12x12 feet for a king — that leaves enough wall clearance for nightstands and walking around. A 13x13 or larger room gives more comfortable circulation. The bed itself is 76" wide, so account for at least 24" of walking space on each side.',
  },
];

const CAL_KING_FAQ: FaqItem[] = [
  {
    q: 'Is a California king right for me?',
    a: 'California king is the right pick if you or your partner is 6 feet tall or taller — its 84" length gives you 4 extra inches of foot room compared to a standard king or queen. The trade-off is 4" less width than a standard king (72" vs 76"). For couples under 6 feet, a standard king is usually the better fit.',
  },
  {
    q: 'Are California king sheets harder to find?',
    a: 'Slightly. Most home stores carry standard king bedding by default, with Cal King as a special-order. We stock Cal King sheets, fitted sheets, and mattress protectors at every showroom, and our online sizing page lists which models are available in Cal King.',
  },
  {
    q: 'Does a California king need a special bed frame?',
    a: 'Yes — Cal King bed frames and foundations are sized specifically (72" x 84"); a standard king frame is too wide and too short. Most major brands offer both king and Cal King variants of every bed frame, foundation, and adjustable base. We confirm frame compatibility before delivery so you don\'t end up with a mismatch.',
  },
];

const TWIN_FAQ: FaqItem[] = [
  {
    q: 'Twin vs Twin XL — which one do I need?',
    a: 'A standard twin is 38" wide by 75" long; a Twin XL is the same width but 5" longer at 80". Twin is right for kids and shorter adults; Twin XL is the choice for taller teens, college students (most dorm beds require Twin XL), and adults who need foot room. For bunk beds and trundles, check the frame spec — most are sized for standard twin.',
  },
  {
    q: 'Is a twin mattress okay for an adult?',
    a: 'For a single adult under 6 feet, yes — a twin works in a guest room, studio apartment, or anywhere space is tight. For taller adults, jump to Twin XL or Full. Couples should not share a twin; it\'s only 38" wide (a queen is 60").',
  },
  {
    q: 'What\'s the right foundation for a twin?',
    a: 'A twin foundation, box spring, slatted platform, or adjustable base. For bunk beds and trundles, check the maximum mattress thickness on the frame — most cap out at 8–10 inches for the top bunk for safety reasons. We stock low-profile twins specifically for bunks.',
  },
];

const TWIN_XL_FAQ: FaqItem[] = [
  {
    q: 'What is the difference between Twin and Twin XL?',
    a: 'Same width (38"), different length: Twin is 75" long, Twin XL is 80" long. Twin XL is the standard size for college dorms (most universities require it), and it\'s the size that two-of pair up to form a Split King for adjustable bases. Twin XL suits adults up to about 6\'3"; taller sleepers should consider a Full or Cal King.',
  },
  {
    q: 'Will Twin sheets fit a Twin XL mattress?',
    a: 'No — the 5-inch length difference means a Twin fitted sheet will be too short. Use Twin XL bedding specifically. We carry Twin XL sheets, mattress protectors, and bedding sets at every showroom and online.',
  },
  {
    q: 'Can I use two Twin XL mattresses as a Split King?',
    a: 'Yes — two Twin XL mattresses placed side-by-side equal the exact dimensions of a standard King (76" x 80"). This is the standard configuration for couples using a split adjustable base where each side can elevate independently. If you go this route, look for Twin XLs designed to pair (the seam down the middle should be flush).',
  },
];

const FULL_FAQ: FaqItem[] = [
  {
    q: 'What are full mattress dimensions?',
    a: 'A full (also called "double") mattress is 54" wide by 75" long. It\'s a 16" upgrade in width over a twin and works well for a single adult or a child transitioning out of a twin. Two adults sharing a full have only 27" each — narrower than a single twin — so couples should generally go up to a queen.',
  },
  {
    q: 'Full vs queen — when is full the right call?',
    a: 'Full is the right call when your bedroom is too tight for a queen (under 9x9 feet), you\'re shopping for a single adult or teen, or you want to save $100–$300 compared to a comparable queen. Queen is the right call for couples, for guest rooms where adult guests might stay overnight, or anytime you have the space.',
  },
  {
    q: 'How much room do I need for a full mattress?',
    a: 'A bedroom of at least 9x10 feet gives a full mattress enough wall clearance for one nightstand. 10x10 or larger lets you add a second nightstand and walking space on both sides. The mattress itself takes up 54" x 75" of floor space.',
  },
];

const SPLIT_KING_FAQ: FaqItem[] = [
  {
    q: 'What exactly is a split king mattress?',
    a: 'A split king is two Twin XL mattresses placed side-by-side that together equal a standard King (76" x 80"). The split lets each side adjust independently on a split adjustable base — one person can elevate the head for reading while the other stays flat, or use different firmness preferences on each side.',
  },
  {
    q: 'Why would I want a split king instead of a regular king?',
    a: 'Three reasons: (1) you and your partner have different sleep position preferences and want independent head/foot adjustment on an adjustable base; (2) one of you has acid reflux or snoring and wants nightly head elevation without affecting the other; (3) you have very different firmness preferences and want different mattresses on each side. If none of those apply, a standard king is simpler.',
  },
  {
    q: 'Do I need special sheets for a split king?',
    a: 'You need two Twin XL fitted sheets (or specially-made "split king" fitted sheets that fit each side separately) plus a king-size flat sheet, comforter, and pillows on top. Standard king fitted sheets won\'t work because they pull both halves together and defeat the independent-adjustment feature.',
  },
];

// ─────────────────────────────────────────────────────────────────────
// Use-case FAQs (back-pain / side-sleeper / couples). High-traffic
// shopper-intent collections that previously fell through to GENERIC.
// ─────────────────────────────────────────────────────────────────────

const BACK_PAIN_FAQ: FaqItem[] = [
  {
    q: 'What\'s the best mattress firmness for back pain?',
    a: 'Medium-firm is the most-recommended firmness for back pain across decades of sleep-medicine research — firm enough to keep the spine aligned, soft enough to relieve pressure at the shoulders and hips. Too soft and the lower back sags; too firm and the shoulders/hips bear concentrated pressure. Our sleep quiz at /sleep-quiz factors body weight and sleep position into the firmness recommendation.',
  },
  {
    q: 'Memory foam or hybrid for back pain?',
    a: 'Both work, but hybrids (foam over coils) tend to suit a wider range of back-pain shoppers because the coil support keeps the spine neutral while the foam relieves pressure. Memory foam is a strong pick if you specifically have shoulder/hip pressure issues — it contours more deeply. Innerspring without comfort foam is generally too firm and unyielding for chronic back pain.',
  },
  {
    q: 'How long until a new mattress relieves my back pain?',
    a: 'Allow 30 nights for your body to adjust — that\'s why our 120-night guarantee requires a 30-night minimum before exchange. Most shoppers feel improvement within 2 weeks; full benefits show up by day 30–60. If pain worsens or doesn\'t improve at all after 30 nights, exchange for a different firmness or construction at no charge.',
  },
];

const SIDE_SLEEPER_FAQ: FaqItem[] = [
  {
    q: 'What\'s the best mattress for side sleepers?',
    a: 'Memory foam and hybrid mattresses with a medium to medium-soft firmness work best for side sleepers. They contour around the shoulder and hip — the two pressure points that bear your body weight in this position — instead of forcing them to push back against a firm surface. Latex is also a strong option, especially for hot sleepers who want side-sleeper comfort without the heat retention of foam.',
  },
  {
    q: 'Will a firm mattress hurt side sleepers?',
    a: 'Usually yes. Firm mattresses don\'t let the shoulder and hip sink in, which concentrates pressure on those points and pushes the spine out of alignment. Side sleepers who use firm mattresses often wake with shoulder, hip, or lower-back pain. The exceptions are very lightweight sleepers (under 130 lbs) who don\'t compress softer mattresses enough.',
  },
  {
    q: 'What pillow do I need with a side-sleeper mattress?',
    a: 'A medium-to-high loft pillow that fills the gap between your neck and the mattress — usually 4–6 inches of loft for side sleepers. Side sleeping with a flat pillow drops the head and twists the neck. Memory foam, shredded foam, and latex pillows all work; cycling 1–3 years is typical regardless of material.',
  },
];

const COUPLES_FAQ: FaqItem[] = [
  {
    q: 'What\'s the best mattress size for couples?',
    a: 'Queen (60" x 80") is the practical minimum for couples — each person gets 30" of personal space, similar to a twin bed. King (76" x 80") adds 16 more inches of width and is the better pick if you have the bedroom space and one or both of you moves around at night. California king is the right call only if one of you is 6\'+ tall and needs the 4 extra inches of length.',
  },
  {
    q: 'How do I find a mattress that works for two different sleepers?',
    a: 'Look for three features: medium firmness (the universal middle ground for differing preferences), strong motion isolation (so one partner\'s movement doesn\'t wake the other — memory foam and pocketed-coil hybrids both excel), and reinforced edges (lets you sleep all the way to the edge without rolling off). If preferences are truly opposite, a Split King with two Twin XLs lets each side use a different firmness.',
  },
  {
    q: 'My partner sleeps hot but I sleep cold — what do we do?',
    a: 'Look for hybrid or latex mattresses (both breathe better than all-foam) with a cooling cover — those are neutral for cool sleepers but actively help hot sleepers. Pair with a dual-zone heated mattress pad so the cold sleeper can warm just their side. Avoid all-foam mattresses without cooling tech if one partner runs hot.',
  },
];

// ─────────────────────────────────────────────────────────────────────
// Firmness FAQs. Each firmness category gets its own bank since the
// shopper concerns differ (soft = "will I sink", firm = "will it
// hurt my hips", medium = "will it work for both of us").
// ─────────────────────────────────────────────────────────────────────

const SOFT_FAQ: FaqItem[] = [
  {
    q: 'Who should buy a soft or plush mattress?',
    a: 'Soft and plush mattresses suit side sleepers (especially those under 200 lbs), shoppers with shoulder or hip pressure-point pain, and combination sleepers who want a "sink in" feel. They\'re generally not the right pick for stomach sleepers (the hips sink and arch the lower back) or for shoppers over 250 lbs (you may bottom out the comfort layer).',
  },
  {
    q: 'Will I sink in too much on a plush mattress?',
    a: 'Modern plush mattresses use multi-density comfort layers — a softer top for pressure relief over a denser support core that prevents you from sinking too deep. The sensation is "cradled" rather than "swallowed." If you\'re between two firmness options and worried about sinking, the medium-plush or medium variant is usually the right move.',
  },
  {
    q: 'How long does a plush mattress hold its shape?',
    a: 'Quality plush mattresses last 7–10 years before noticeable body impressions appear. Rotation every 3–6 months extends the life significantly, especially for one-sided builds (which is most modern plush mattresses). Plush mattresses do soften over their first few months of use as the foam breaks in — this is normal and expected.',
  },
];

const MEDIUM_FAQ: FaqItem[] = [
  {
    q: 'What does "medium firmness" actually feel like?',
    a: 'Medium sits right in the middle of the firmness scale — softer than a hotel mattress, firmer than a pillow-top. You feel cradled at the shoulder and hip without sinking deep into the bed. Medium is the most universally-comfortable firmness across body types and sleep positions, which is why it\'s our most-recommended setting from the sleep quiz.',
  },
  {
    q: 'Is medium too soft for back sleepers?',
    a: 'Usually no — medium provides enough lumbar support for most back sleepers while contouring at the shoulders. The exceptions are back sleepers over 230 lbs who often need medium-firm to keep the lower back from sinking, and back sleepers with chronic lumbar pain who tend to do better on medium-firm to firm.',
  },
  {
    q: 'Medium vs medium-firm — how do I choose?',
    a: 'Medium suits side sleepers, lighter body weights (under 180 lbs), and shoppers who want pressure relief at the shoulders/hips. Medium-firm suits back and stomach sleepers, heavier body weights (over 200 lbs), and shoppers with back pain who need stronger lumbar support. Combo sleepers often do well on medium-firm because it doesn\'t restrict position changes.',
  },
];

const MEDIUM_FIRM_FAQ: FaqItem[] = [
  {
    q: 'Who should buy a medium-firm mattress?',
    a: 'Medium-firm is the firmness most-recommended by sleep researchers for back pain — it keeps the spine aligned without concentrating pressure. It also suits back sleepers, stomach sleepers, combination sleepers, and anyone over about 200 lbs who needs more support than a medium provides. It\'s our top recommendation when the sleep quiz is ambiguous between firmness levels.',
  },
  {
    q: 'Will medium-firm feel hard?',
    a: 'No — medium-firm still contours at the shoulders and hips, just less deeply than a medium. Think "supportive with cushion" rather than "hard." If you\'re used to a soft mattress, there\'s a 1–2 week adjustment period as your body adapts. If after 30 nights it still feels too firm, our 120-night guarantee lets you exchange for a softer model.',
  },
  {
    q: 'Is medium-firm good for side sleepers?',
    a: 'For side sleepers over 200 lbs, often yes — heavier shoppers compress softer mattresses too much and end up out of alignment. Lighter side sleepers (under 180 lbs) usually prefer medium or medium-soft because they need more contour at the shoulder and hip. The sleep quiz factors body weight into the firmness recommendation.',
  },
];

const FIRM_FAQ: FaqItem[] = [
  {
    q: 'Who needs a firm mattress?',
    a: 'Stomach sleepers (a firmer surface prevents the hips from sinking and arching the lower back), back sleepers who specifically prefer minimal contour, heavier shoppers over 250 lbs who compress softer mattresses too much, and shoppers with chronic lower-back pain who feel best with maximum lumbar support.',
  },
  {
    q: 'Will a firm mattress hurt my shoulders and hips?',
    a: 'It can — firm mattresses don\'t let the shoulder and hip sink in, which concentrates pressure on those points. Side sleepers typically wake with shoulder, hip, or arm pain on a firm mattress unless they\'re very lightweight. If you side-sleep, look for medium or medium-firm instead. If you back- or stomach-sleep, firm is usually well-tolerated.',
  },
  {
    q: 'Is firm or extra-firm right for back pain?',
    a: 'Medium-firm — not firm or extra-firm — is the firmness most-supported by research for back pain. Firm mattresses can actually worsen lower-back pain by failing to contour to the lumbar curve. Try medium-firm first; only step up to firm or extra-firm if you specifically prefer a less-contouring feel and don\'t have side-sleeper pressure-point issues.',
  },
];

// ─────────────────────────────────────────────────────────────────────
// Feature / format / tier FAQs.
// ─────────────────────────────────────────────────────────────────────

const COOLING_FAQ: FaqItem[] = [
  {
    q: 'What actually makes a mattress "cooling"?',
    a: 'Three things, usually in combination: (1) breathable construction — hybrids and innersprings allow more airflow than all-foam; (2) heat-dissipating materials in the comfort layer — gel-infused foam, copper, graphite, or phase-change material; (3) cooling covers like TENCEL, copper-blend fabric, or phase-change cooling fabric on the surface. The best cooling mattresses combine all three.',
  },
  {
    q: 'Are gel-infused mattresses really cooler?',
    a: 'Modestly. Gel-infused foam pulls heat away from the body for the first few hours of sleep, but it can saturate and lose effectiveness in the later hours. For shoppers who run very hot, look for phase-change cooling covers (Tempur-Pedic ProBreeze, Stearns & Foster) or hybrid construction with a copper-infused or TENCEL cover — these tend to cool more consistently through the night than gel alone.',
  },
  {
    q: 'What\'s the coolest material — foam, hybrid, or latex?',
    a: 'Latex generally sleeps coolest because of its open-cell structure and natural airflow. Hybrid is a close second — the coil core lets heat escape under the comfort foam. All-foam mattresses sleep warmest by default; adding cooling features (gel, phase-change covers) helps but rarely matches the airflow of a hybrid or latex bed. Hot sleepers should look at latex or hybrid first.',
  },
];

const PILLOW_TOP_FAQ: FaqItem[] = [
  {
    q: 'What is a pillow-top mattress?',
    a: 'A pillow-top is a mattress with an extra layer of cushioning material sewn or attached on top of the main mattress, giving a noticeably softer, more cradled feel at the surface. Pillow-tops were historically attached as a separate layer; modern pillow-tops are usually integrated into the cover. They\'re popular with shoppers who want luxury-hotel softness without giving up the support of a firm core underneath.',
  },
  {
    q: 'Pillow-top vs Euro-top — what\'s the difference?',
    a: 'A pillow-top sits on top of the mattress with a visible gap or "gusset" around the edge, giving it a distinct rounded look. A Euro-top is integrated flush with the sides of the mattress for a more uniform, modern profile. Functionally similar — both add a soft comfort layer — but Euro-tops typically have better edge support because the comfort layer extends all the way to the sides.',
  },
  {
    q: 'Will a pillow-top mattress hold up over time?',
    a: 'Quality pillow-tops last 7–10 years before noticeable body impressions. Rotation every 3–6 months is critical — pillow-tops are one-sided builds, so rotating distributes wear evenly across the surface. Brands like Stearns & Foster and Chattam & Wells use hand-tufted construction to anchor the comfort layer and minimize shifting over time.',
  },
];

const LUXURY_FAQ: FaqItem[] = [
  {
    q: 'What makes a mattress "luxury"?',
    a: 'Luxury mattresses use higher-grade materials (Talalay latex, cashmere-blend covers, copper-infused foams, hand-tufted construction), deeper builds (14–17 inches vs the standard 10–12), and longer warranties (typically 15+ years). The brands in this category — Stearns & Foster, Chattam & Wells, Tempur-Pedic, Aireloom, Hastens — invest in materials and craftsmanship that mid-tier mattresses can\'t justify at their price points.',
  },
  {
    q: 'Is a luxury mattress worth 2–3x the price of a mid-tier model?',
    a: 'For shoppers planning to keep the mattress 10+ years, often yes — the cost per year of use ends up similar, and the comfort and durability are noticeably better. For shoppers who replace mattresses every 5–7 years or have a tight budget, a quality mid-tier model usually delivers 80% of the luxury experience for 40% of the price. Our showroom team can walk you through the side-by-side trade-offs.',
  },
  {
    q: 'What\'s the longest-lasting luxury mattress?',
    a: 'Natural-latex luxury mattresses last the longest — 15–20+ years with proper care. Southerland\'s Scandinavian Collection (12-year warranty), Tempur-Pedic\'s ProAdapt and LuxeAdapt lines (10-year), and Stearns & Foster\'s Reserve collection (15-year) are the longest-lifespan options we carry. Latex consistently outlasts memory foam and innerspring at the luxury tier.',
  },
];

const BED_IN_BOX_FAQ: FaqItem[] = [
  {
    q: 'How does bed-in-a-box delivery work?',
    a: 'The mattress is compressed and rolled, then shipped in a manageable box (about 18" x 18" x 42"). At home, you carry the box to the bedroom, unbox the mattress on top of your foundation, and unroll it. Once you cut the plastic, the mattress decompresses and reaches near-full size within an hour. Full expansion takes 24–72 hours.',
  },
  {
    q: 'Will a bed-in-a-box mattress reach full size?',
    a: 'Yes — modern bed-in-a-box mattresses are engineered to recover full size after compression. Allow 24–72 hours for the foam layers to fully expand before sleeping on it. Some mattresses may have an initial off-gassing smell from the new foam; airing out the bedroom for a few hours typically resolves it.',
  },
  {
    q: 'Bed-in-a-box vs traditional white-glove delivery?',
    a: 'Bed-in-a-box is faster to set up and easier to get up stairs/through tight doorways. White-glove delivery (free over $499 in LA) includes setup, removal of packaging, and haul-away of your old mattress — so you skip the heavy lifting and disposal hassle. Bed-in-a-box ships nationally; white-glove is LA-only.',
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

  // ────────────────────────────────────────────────────────────────
  // Routing order is intentional — substring matches collide if the
  // wrong check fires first. Two real bugs in the previous order
  // (Phase 276) the current order fixes:
  //
  //   - pillow-top-mattresses used to match PILLOW_FAQ (because
  //     "pillow" is a substring of "pillow-top"). It's a mattress
  //     construction, not a pillow PLP.
  //   - twin-xl-mattress-sale used to match SALE_FAQ (because "sale"
  //     is a substring). It's a size collection, not a sale page.
  //
  // Rule: most-specific compound handles checked first. For nested
  // matches (split-king vs king, twin-xl vs twin, medium-firm vs
  // firm/medium, extra-firm vs firm, ultra-plush vs plush), the
  // longer form is always checked before the shorter.
  // ────────────────────────────────────────────────────────────────

  // 1. Compound construction handles (must beat the substring matches
  //    further down — pillow-top must beat pillow, bed-in-a-box must
  //    beat any material match).
  if (h.includes('pillow-top')) return [...PILLOW_TOP_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('bed-in-a-box')) return [...BED_IN_BOX_FAQ, ...UNIVERSAL_FAQ];

  // 2. Use-case (back-pain, side-sleepers, couples). These are
  //    high-intent shopper collections and should win over any
  //    material/brand substring that might happen to appear in the
  //    handle.
  if (h.includes('back-pain')) return [...BACK_PAIN_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('side-sleeper')) return [...SIDE_SLEEPER_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('couples')) return [...COUPLES_FAQ, ...UNIVERSAL_FAQ];

  // 3. Sizes (most-specific first — split-king beats king, twin-xl
  //    beats twin, california-king beats king). Sizes win over the
  //    sale substring so twin-xl-mattress-sale routes correctly.
  if (h.includes('split-king') || h.includes('split-cal') || h.includes('split-california')) {
    return [...SPLIT_KING_FAQ, ...UNIVERSAL_FAQ];
  }
  if (h.includes('california-king') || h.includes('cal-king')) {
    return [...CAL_KING_FAQ, ...UNIVERSAL_FAQ];
  }
  if (h.includes('twin-xl')) return [...TWIN_XL_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('queen')) return [...QUEEN_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('king')) return [...KING_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('twin')) return [...TWIN_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('full-size') || h.includes('full-mattress')) {
    return [...FULL_FAQ, ...UNIVERSAL_FAQ];
  }

  // 4. Firmness (most-specific first — medium-firm beats both medium
  //    and firm, extra-firm beats firm, ultra-plush beats plush).
  if (h.includes('medium-firm')) return [...MEDIUM_FIRM_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('extra-firm') || h.includes('firm-mattress') || h === 'firm') {
    return [...FIRM_FAQ, ...UNIVERSAL_FAQ];
  }
  if (h.includes('medium')) return [...MEDIUM_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('ultra-plush') || h.includes('plush') || h.includes('soft-mattress')) {
    return [...SOFT_FAQ, ...UNIVERSAL_FAQ];
  }

  // 5. Accessory categories (adjustable bases, pillows). Must come
  //    BEFORE brand + feature checks so handles like
  //    /collections/tempur-pedic-adjustable-bases route to ADJUSTABLE
  //    (not TEMPUR's mattress FAQ) and /collections/cooling-pillows
  //    routes to PILLOW (not the mattress cooling FAQ). The pillow-top
  //    check at step 1 already protects pillow-top-mattresses from
  //    being caught here.
  if (h.includes('adjustable')) return [...ADJUSTABLE_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('pillow')) return [...PILLOW_FAQ, ...UNIVERSAL_FAQ];

  // 6. Brand-specific
  if (h.includes('tempur')) return [...TEMPUR_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('stearns') && h.includes('foster')) return [...STEARNS_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('helix')) return [...HELIX_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('southerland') || h.includes('scandinavian')) return [...SOUTHERLAND_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('englander')) return [...ENGLANDER_FAQ, ...UNIVERSAL_FAQ];

  // 7. Material-specific
  if (h.includes('memory-foam') || h.includes('foam')) return [...MEMORY_FOAM_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('hybrid')) return [...HYBRID_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('latex')) return [...LATEX_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('innerspring') || h.includes('pocketed-coil')) {
    return [...INNERSPRING_FAQ, ...UNIVERSAL_FAQ];
  }

  // 8. Feature / tier (mattress-specific — accessory checks above
  //    have already routed pillow/adjustable variants).
  if (h.includes('cooling')) return [...COOLING_FAQ, ...UNIVERSAL_FAQ];
  if (h.includes('luxury')) return [...LUXURY_FAQ, ...UNIVERSAL_FAQ];

  // 9. Sale / clearance (last — every other category beats this so
  //    handles like twin-xl-mattress-sale don't get the sale FAQ).
  if (h.includes('sale') || h.includes('clearance') || h.includes('floor-model')) {
    return [...SALE_FAQ, ...UNIVERSAL_FAQ];
  }

  // 10. Generic mattress fallback
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
    return `Twin-size mattresses (38" × 75") suit kids' rooms, teen bedrooms, bunk beds, daybeds, trundles, dorms, and guest rooms. ${title} on this page span memory foam, hybrid, and innerspring builds across every firmness; size up to a twin XL for taller teens. Free white-glove delivery in Los Angeles on orders over $499.`;
  }

  // Generic mattress fallback
  return `Every model on this page is on the floor at one of our 5 LA showrooms — Koreatown, West LA, La Brea, Studio City, and Glendale — so you can try before you buy. Free white-glove delivery on orders over $499 anywhere in Los Angeles, 120-night Love Your Bed Guarantee, and 0% APR financing through Synchrony and Acima.`;
}

/**
 * Curated cornerstone buying-guide articles to surface as in-content
 * internal links on the matching collection PLP.
 *
 * The SEMrush 20260518 On-Page export flagged these high-priority
 * buying-guide articles under "This page doesn't have internal links"
 * (e.g. queen-size-guide priority 612, how-to-choose-the-best-size 540,
 * what-is-the-standard-size-of-a-full-bed 529, king-vs-cal-king 394,
 * full-vs-queen 224). They sit deep in the blog with weak inbound
 * linking. The collection PLPs are high-authority commercial pages —
 * a contextual, topically-matched link from the relevant PLP is the
 * textbook fix (real link equity, not nav/footer boilerplate) and also
 * makes the PLP content block per-category instead of identical.
 *
 * Only matched collections get a block (unmatched → []), so the links
 * stay contextual rather than turning into another boilerplate cluster.
 * All hrefs are verified-present article paths (data/url-inventory).
 * Anchor text is descriptive (also avoids the "non-descriptive anchor
 * text" flag). Same substring-match-on-handle, most-specific-first
 * strategy as categoryFaqFor / categoryIntroFor.
 */
export type CategoryGuide = { href: string; label: string };

const G = {
  chooseSize: {
    href: '/blogs/mattress-buying-guide/how-to-choose-the-best-mattress-size',
    label: 'How to choose the right mattress size',
  },
  kingVsCal: {
    href: '/blogs/mattress-buying-guide/king-vs-california-king',
    label: 'King vs. California King: which is bigger?',
  },
  calVsKing: {
    href: '/blogs/mattress-buying-guide/california-king-vs-king-what-s-the-real-difference',
    label: 'California King vs. King: the real difference',
  },
  queenGuide: {
    href: '/blogs/mattress-buying-guide/queen-mattress-size-guide-inches-feet-how-to-pick-the-perfect-fit',
    label: 'Queen mattress size guide (inches & feet)',
  },
  fullVsQueen: {
    href: '/blogs/mattress-buying-guide/full-vs-queen-mattress',
    label: 'Full vs. Queen: how to pick',
  },
  fullSize: {
    href: '/blogs/mattress-buying-guide/what-is-the-standard-size-of-a-full-bed',
    label: 'What is the standard size of a full bed?',
  },
  fullSpace: {
    href: '/blogs/mattress-buying-guide/how-much-space-does-a-full-size-mattress-really-give-you',
    label: 'How much room does a full really give you?',
  },
  couples: {
    href: '/blogs/sleep-blog/what-is-the-best-mattress-size-for-couples',
    label: 'Best mattress size for couples',
  },
  heavy: {
    href: '/blogs/mattress-buying-guide/best-mattress-for-heavy-people',
    label: 'Best mattress for heavier sleepers',
  },
  stomach: {
    href: '/blogs/mattress-buying-guide/best-affordable-mattress-for-stomach-sleepers',
    label: 'Best affordable mattress for stomach sleepers',
  },
  cooling: {
    href: '/blogs/mattress-buying-guide/best-cooling-mattress-guide',
    label: 'Best cooling mattress guide',
  },
  hypoallergenic: {
    href: '/blogs/mattress-buying-guide/best-hypoallergenic-pillows-and-bedsheets',
    label: 'Hypoallergenic pillows & bed sheets',
  },
} as const;

export function categoryGuidesFor(handle: string): CategoryGuide[] {
  const h = handle.toLowerCase();

  // Size-specific (California King before the generic "king" match).
  if (h.includes('california-king') || h.includes('cal-king')) {
    return [G.kingVsCal, G.calVsKing, G.chooseSize, G.couples];
  }
  if (h.includes('king')) return [G.kingVsCal, G.chooseSize, G.couples];
  if (h.includes('queen')) return [G.queenGuide, G.fullVsQueen, G.chooseSize, G.couples];
  if (h.includes('full')) return [G.fullSize, G.fullSpace, G.fullVsQueen, G.chooseSize];
  if (h.includes('twin') || h.includes('split')) return [G.chooseSize, G.couples];

  // Use-case / material.
  if (h.includes('extra-firm') || h.includes('firm')) return [G.heavy, G.chooseSize];
  if (h.includes('cooling') || h.includes('gel') || h.includes('memory-foam') || h.includes('foam')) {
    return [G.cooling, G.chooseSize];
  }
  if (h.includes('protector') || h.includes('pillow') || h.includes('sheet') || h.includes('comforter')) {
    return [G.hypoallergenic];
  }

  // Broad commercial collections (on-sale, bed-frames, all-mattresses, …)
  // — a general buying cluster so these high-traffic PLPs still pass
  // contextual link equity to the cornerstone guides.
  if (
    h.includes('mattress') ||
    h.includes('sale') ||
    h.includes('clearance') ||
    h.includes('bed-frame') ||
    h.includes('adjustable')
  ) {
    return [G.chooseSize, G.cooling, G.stomach];
  }

  return [];
}
