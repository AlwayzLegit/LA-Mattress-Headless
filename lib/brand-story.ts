// Per-vendor brand-story content (Round 13 — SEMrush issue 223
// errorType 2, duplicate content on the 36 enriched Diamond/Helix PDPs).
//
// A prior enrichment baked a ~130-word brand-story paragraph into every
// product's `descriptionHtml`, identical across all of a brand's PDPs
// (30 Diamond, 6 Helix). Inside the per-product description main-content
// region, that identical block reads as duplicate content across the
// brand's pages. The store-level boilerplate that accompanied it ("Why
// Shop at LA Mattress Store" + the closing call CTA) is fully redundant
// with the PDP FAQ (buildProductFaq already renders delivery, exchange,
// warranty, financing, and showrooms as FAQ JSON-LD), so it is simply
// stripped. The brand story is genuine EEAT content, so it is preserved
// but moved out of the per-product description into a single template
// "brand band" (see pdp-brand-story.tsx) rendered once per PDP in a
// consistent structural position — which search engines treat as brand
// boilerplate rather than duplicate product content.
//
// `signature` is a stable substring used both to (a) look up whether a
// product's description STILL carries the story (so the component and
// the strip script agree on the transition) and (b) let the strip
// script identify the block. Keep it verbatim from the live copy.

export type BrandStory = {
  vendor: string;
  /** Stable substring present in the in-description story paragraph. */
  signature: string;
  /** Short heading for the rendered brand band. */
  heading: string;
  /** The brand-story paragraph text (rendered inside a single <p>). */
  paragraph: string;
};

const STORIES: readonly BrandStory[] = [
  {
    vendor: 'Diamond',
    signature: 'Diamond Mattress is a 4th-generation family-owned company',
    heading: 'About Diamond Mattress',
    paragraph:
      "Diamond Mattress is a 4th-generation family-owned company that has been handcrafting mattresses in Southern California since 1946. Founded by the Pennington family in Compton, California (now headquartered in Rancho Dominguez), Diamond is one of the few mattress manufacturers in America that is fully vertically integrated. They make their own pocketed coils, process their own memory foams, and cut and sew their own fabrics, all under one roof. This level of control over every component means Diamond can maintain strict quality standards that outsourced manufacturers cannot match. Every Diamond mattress is CertiPUR-US certified, GREENGUARD Gold certified for low chemical emissions, OEKO-TEX tested for harmful substances, and ECO INSTITUT certified for environmental safety. Diamond also uses REPREVE recycled fibers in select products, demonstrating their commitment to sustainable manufacturing practices.",
  },
  {
    vendor: 'Helix Sleep',
    signature: 'Helix Sleep was founded in New York City',
    heading: 'About Helix Sleep',
    paragraph:
      "Helix Sleep was founded in New York City by a team of engineers and product designers who were frustrated with the mattress industry’s one-size-fits-all approach. They asked a simple question: if people are different sizes, sleep in different positions, and have different pressure-relief needs, why does everyone buy the same mattress? Their answer was a lineup of hybrid mattresses designed around specific sleep profiles, each model engineered for a particular combination of body type, sleeping position, and firmness preference. Helix’s Sleep Quiz has matched millions of sleepers to their ideal mattress using data-driven recommendations based on sleep science research. Every Helix mattress is designed in New York and manufactured in Phoenix, Arizona, using CertiPUR-US certified foams. All materials are tested for quality and safety, and every mattress comes with a limited lifetime warranty, one of the strongest warranties in the industry, plus a 120-night sleep trial.",
  },
];

/** The brand story for a vendor, or null if we don't have one. */
export function brandStoryFor(vendor: string | null | undefined): BrandStory | null {
  if (!vendor) return null;
  return STORIES.find((s) => s.vendor === vendor) ?? null;
}
