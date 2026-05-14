/**
 * Per-blog descriptive intro paragraphs — surfaced on each /blogs/[blog]
 * index page above the article grid. Boosts text-to-HTML ratio on blog
 * indexes (SEMrush flagged /blogs/sleep-health in the May audit), gives
 * crawlers a clear category signal, and helps users understand what they'll
 * find before scanning headlines.
 *
 * Phase 260c: same pattern as the PLP content block (Phase 265). One
 * intro per blog handle; falls back to a generic mattress-shopping intro
 * for unmapped handles so the block never renders empty.
 */

const INTROS: Record<string, string> = {
  'mattress-buying-guide':
    "Our mattress buying guide breaks down the decision the way our showroom staff would: by sleep position, body weight, temperature sensitivity, pain points, and budget. Every article below is researched against the brands we actually stock — Tempur-Pedic, Stearns & Foster, Helix, Diamond, Southerland, Englander, Eastman House — and tested against what real customers tell us after they sleep on the mattress for a week. Whether you're shopping for your first king-size, replacing a 10-year-old set, or trying to figure out whether memory foam will sleep too hot, start here.",
  'sleep-blog':
    "The LA Mattress sleep blog is where we publish what we learn from selling mattresses across five Los Angeles showrooms for over a decade. Articles cover sleep position fit, brand comparisons, mattress-care basics, financing and delivery FAQs, and the occasional weirder topic (sleep latency, bedtime snacks, lucid dreaming). If you'd rather talk to a real person, every showroom is open daily — no appointment needed.",
  'sleep-health':
    "Sleep is half rest, half recovery. The articles in our sleep-health section cover the medical, lifestyle, and environmental sides of sleep: chronic pain and the mattress's role in alleviating or aggravating it, sleep apnea and CPAP-friendly bed setups, partner sleep dynamics, sleep during pregnancy, and the cluster of habits (caffeine timing, screen exposure, bedroom temperature) that decide how rested you wake up. None of this is medical advice — talk to your doctor — but a lot of it is the kind of practical context that shoppers don't get on the back of a mattress tag.",
  'mattress-care-tips':
    "Mattress care decides whether your investment lasts 8 years or 15. The articles below cover the four habits that move that needle the most: rotation cadence by mattress type, the right protector for your sleep style, stain and odor recovery, and end-of-life disposal (recycling, not landfill — every white-glove delivery we make includes free haul-away of the old mattress). Built from what our delivery and service teams see on a daily basis.",
  'sales':
    "Memorial Day, Labor Day, Black Friday, end-of-quarter clearance — the articles below cover what's on sale right now, what the markdown actually means relative to MSRP, and which models tend to repeat at the deepest discounts. Floor-model and clearance inventory rotates weekly across our 5 LA showrooms, so calling ahead to confirm availability before driving over is worth the 30 seconds.",
};

const FALLBACK_INTRO =
  "Articles, guides, and notes from the team at LA Mattress Store. Five LA showrooms, premium brands across every material and price tier, white-glove delivery anywhere in Los Angeles, and a 120-night Love Your Bed Guarantee on every mattress we sell.";

export function blogIntroFor(handle: string): string {
  return INTROS[handle] ?? FALLBACK_INTRO;
}
