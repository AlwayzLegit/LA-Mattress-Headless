/**
 * Articles intentionally kept OUT of the search index.
 *
 * These are programmatic, near-duplicate location/brand "doorway"-style
 * posts (e.g. "{brand} mattresses serving {neighborhood}") that the
 * legacy site deliberately blocked from crawling. The headless build
 * otherwise indexes every article + lists it in the sitemap, which would
 * re-expose the thin/duplicate-content (doorway-page) risk Google
 * penalizes. List sourced from the SEMrush "Blocked from crawling"
 * audit (2026-05-17), scoped to real blog articles only — legacy
 * /pages/* URLs in that report are legitimate and 301-redirected, so
 * they are NOT included here.
 *
 * Keyed by `"{blogHandle}/{articleHandle}"`. Consumed by the article
 * template's generateMetadata (emits `robots: noindex, follow`) and by
 * app/sitemap.ts (excluded from the sitemap). `follow: true` keeps
 * internal link equity flowing while removing the page from the index.
 *
 * To re-include a post: improve it to be genuinely unique, then remove
 * its key here.
 */
const NOINDEX_ARTICLES: ReadonlySet<string> = new Set([
  // Cannibalization prune (2026-05-19, live SEMrush per-URL pull):
  // thin vehicle-specific air-mattress doorway swarm + zero-traffic
  // "best/comparison queen" listicles that split signal off the
  // cluster winners. See docs/seo-prune-list.md.
  'mattress-buying-guide/air-mattress-for-jeep-gladiator',
  'mattress-buying-guide/air-mattress-for-subaru-crosstrek',
  'mattress-buying-guide/air-mattress-for-subaru-forester',
  'mattress-buying-guide/best-air-mattress-for-heavyweights',
  'mattress-buying-guide/firm-vs-plush-queen-mattress-how-to-choose-for-your-sleep-style',
  'mattress-buying-guide/how-to-set-up-a-truck-bed-air-mattress-for-camping',
  'mattress-buying-guide/memory-foam-vs-hybrid-queen-mattress-which-one-helps-you-sleep-better',
  'mattress-buying-guide/sleep-experts-rate-the-ultimate-queen-memory-foam-mattresses',
  'mattress-buying-guide/top-5-cooling-queen-mattresses-for-hot-sleepers',
  'mattress-buying-guide/top-air-mattress-options-for-road-trips-and-truck-camping',
  'mattress-care-tips/does-temperature-affect-air-mattresses',
  'extra-info/why-memory-foam-mattresses-are-gaining-popularity-in-burbank',
  'mattress-buying-guide/best-black-friday-deals-on-mattresses',
  'mattress-buying-guide/best-mattress-for-your-la-neighborhood',
  'mattress-buying-guide/best-queen-mattress-sales-happening-near-you',
  'mattress-buying-guide/black-friday-mattress-sales',
  'mattress-buying-guide/choosing-the-right-mattress-for-luxurious-sleep-after-a-day-of-travel-and-adventure',
  'mattress-buying-guide/clearance-mattress-sale-live-in-la-right-now',
  'mattress-buying-guide/combine-coastal-living-and-premium-mattresses-for-malibu-residents-perfect-sleep',
  'mattress-buying-guide/culver-city-is-choosing-hybrid-mattresses-for-better-sleep-4',
  'mattress-buying-guide/cyber-monday-mattress-sale-in-west-los-angeles',
  'mattress-buying-guide/discover-better-sleep-solutions-with-sealy-posturepedic-mattresses-in-encino-1',
  'mattress-buying-guide/discover-elite-chattam-wells-and-stearns-foster-mattress-collections-near-beverly-hills',
  'mattress-buying-guide/discover-natural-latex-bliss-near-western-ave',
  'mattress-buying-guide/discover-superior-sleep-solutions-with-organic-mattresses-close-to-pico-robertson',
  'mattress-buying-guide/enjoy-restful-nights-with-chattam-wells-luxury-mattresses-near-toluca-lake',
  'mattress-buying-guide/enjoy-serene-sleep-with-organic-mattresses-serving-valley-village',
  'mattress-buying-guide/enjoy-top-tier-comfort-with-our-luxury-mattresses-serving-alsace-and-beyond',
  'mattress-buying-guide/enjoy-unmatched-comfort-with-stearns-foster-mattresses-serving-rancho-park',
  'mattress-buying-guide/experience-deep-restful-sleep-with-diamond-mattress-collections-in-the-san-fernando-valley',
  'mattress-buying-guide/experience-memory-foam-dreams-near-vermont-ave',
  'mattress-buying-guide/experience-perfect-sleep-with-diamond-mattress-collections-near-playa-vista',
  'mattress-buying-guide/experience-unmatched-comfort-with-stearns-foster-mattresses-serving-brentwood',
  'mattress-buying-guide/explore-premium-pillow-top-mattress-deals-a-short-drive-from-beverly-hills',
  'mattress-buying-guide/find-the-perfect-mattress-near-westwood-explore-our-top-rated-selections',
  'mattress-buying-guide/find-unmatched-comfort-just-around-the-corner-from-hyperion',
  'mattress-buying-guide/get-your-best-rest-yet-with-firm-mattresses-near-van-nuys',
  'mattress-buying-guide/indulge-in-pillow-top-luxury-near-normandie-ave',
  'mattress-buying-guide/memorial-day-mattress-sale-near-me',
  'mattress-buying-guide/relax-in-coastal-comfort-with-premium-organic-mattresses-close-to-venice-beach',
  'mattress-buying-guide/set-sail-for-better-sleep-with-diamond-mattresses-in-the-marina-del-rey-area',
  'mattress-buying-guide/shop-best-organic-mattresses-near-larchmont',
  'mattress-buying-guide/shop-quality-diamond-mattresses-convenient-to-culver-city-for-superior-comfort',
  'mattress-buying-guide/sleep-soundly-with-top-rated-organic-mattresses-just-minutes-from-ladera-heights',
  'mattress-buying-guide/sleeping-better-in-beverlywood-with-gel-foam-mattresses',
  'mattress-buying-guide/the-rise-of-latex-mattresses-in-west-hollywood',
  'mattress-buying-guide/top-reasons-to-buy-adjustable-bed-bases-in-burbank',
  'mattress-buying-guide/top-reasons-to-buy-hybrid-mattresses-in-bel-air',
  'mattress-buying-guide/top-reasons-to-buy-hybrid-mattresses-in-hollywood',
  'mattress-buying-guide/top-reasons-to-buy-hybrid-mattresses-in-rancho-park',
  'mattress-buying-guide/top-reasons-to-buy-latex-mattresses-in-larchmont-4',
  'mattress-buying-guide/top-reasons-to-buy-memory-foam-mattresses-in-downtown-los-angeles',
  'mattress-buying-guide/top-reasons-to-buy-organic-latex-mattresses-in-palms',
  'mattress-buying-guide/transform-your-nights-with-high-quality-mattresses-close-to-beverly-grove',
  'mattress-buying-guide/transform-your-sleep-at-the-nearest-mattress-store-to-burbank',
  'mattress-buying-guide/uncover-better-sleep-solutions-near-tujunga',
  'mattress-buying-guide/unlock-restful-nights-with-luxury-mattresses-just-minutes-from-palms',
  'mattress-buying-guide/unwind-with-superior-gel-foam-mattresses-near-sun-valley',
  'mattress-buying-guide/upgrade-your-nights-with-luxury-chattam-wells-mattresses-accessible-from-sawtelle',
  'mattress-buying-guide/what-makes-gel-foam-mattresses-a-hit-in-pasadena',
  'mattress-buying-guide/what-makes-gel-foam-mattresses-a-hit-in-playa-vista',
  'mattress-buying-guide/when-is-the-best-time-to-buy-a-mattress',
  'mattress-buying-guide/where-to-buy-a-queen-mattress-near-you-local-vs-online-comparison',
  'mattress-buying-guide/why-adjustable-beds-are-gaining-popularity-in-universal-city',
  'mattress-buying-guide/why-does-choosing-the-right-mattress-store-near-me-matter',
  'mattress-buying-guide/why-memory-foam-mattresses-are-gaining-popularity-in-venice',
  'mattress-buying-guide/why-pillow-top-mattresses-are-the-ultimate-sleep-luxury-in-beverly-hills',
  'mattress-care-tips/madcap-cottage-bedroom-therapy',
  'sleep-blog/new-year-resolutions-2014',
  'sleep-blog/unveiling-the-secrets-what-women-really-want-when-it-comes-to-mattre',
  'sleep-health/caffeine-how-does-it-affect-our-health',
  'sleep-health/sleep-disorder-5701',
]);

export function isNoindexArticle(blogHandle: string, articleHandle: string): boolean {
  return NOINDEX_ARTICLES.has(`${blogHandle}/${articleHandle}`);
}
