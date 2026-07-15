import { brandStoryFor } from '@/lib/brand-story';

/**
 * Per-vendor "brand band" rendered once on the PDP, below the product
 * description (Round 13, SEMrush issue 223 errorType 2).
 *
 * The brand story used to live inside every product's `descriptionHtml`,
 * identical across all of a brand's PDPs — duplicate main content. It's
 * now rendered here, in a consistent template position, for the vendors
 * we have a story for (Diamond, Helix Sleep).
 *
 * Self-gating for a seamless migration: while a product's description
 * STILL contains the story (its `signature`), this renders nothing — so
 * the component can deploy before the Shopify strip runs without ever
 * showing the story twice, and starts rendering automatically once the
 * strip removes the paragraph from that product's description. Products
 * with no brand story, or whose description was never enriched, render
 * nothing.
 */
export function PdpBrandStory({
  vendor,
  descriptionHtml,
}: {
  vendor: string | null | undefined;
  descriptionHtml: string | null | undefined;
}) {
  const story = brandStoryFor(vendor);
  if (!story) return null;
  // Description still carries the story → don't double it.
  if (descriptionHtml && descriptionHtml.includes(story.signature)) return null;

  return (
    <section className="pdp-section pdp-brand-story">
      <div className="eyebrow">The brand</div>
      <h2 className="h2">{story.heading}</h2>
      <p>{story.paragraph}</p>
    </section>
  );
}
