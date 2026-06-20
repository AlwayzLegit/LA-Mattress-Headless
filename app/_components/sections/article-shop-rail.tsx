import Link from 'next/link';
import { getCollectionByHandle } from '@/lib/shopify/queries/collection';
import { RelatedRail } from '@/app/(storefront)/products/[handle]/related-rail';
import { Icon } from '@/app/_components/icon';

/**
 * End-of-article shop module. Renders BELOW the body and ABOVE the related-
 * guides rail to convert reading intent into purchase intent.
 *
 * Why this exists: the internal analytics dashboard showed the top 10
 * articles each pulling 140–210 sessions/30d but converting at 0.00% —
 * the prior article CTAs only pointed at MORE READING (related guides,
 * "all articles", the quiz). There was no end-of-read shop surface, so
 * every article was an SEO funnel into a dead end.
 *
 * What it does:
 *   1. Quiz card on the left (highest-converting target from the dashboard
 *      — quiz clicks went 53% to best-match products).
 *   2. Product rail of 6 best-selling mattresses on the right, reusing the
 *      PDP <RelatedRail> for visual + a11y consistency (same pcard styles,
 *      lazy images, accessible scroll buttons).
 *
 * Selection strategy (deliberately simple for the first ship):
 *   - Pulls top 6 BEST_SELLING from the main /collections/mattresses
 *     collection. Works on every article (no per-article mapping to keep
 *     up to date), and best-sellers self-tune as the catalog shifts.
 *   - The in-body autoLinkArticleBody nudges readers to the topically-
 *     relevant collection inline; this module's job is to surface real
 *     product cards regardless of what the article is about.
 *
 * Returns null on miss/error so the article never renders a half-empty
 * section.
 */
export async function ArticleShopRail() {
  const collection = await getCollectionByHandle({
    handle: 'mattresses',
    first: 6,
    sortKey: 'BEST_SELLING',
  });
  const products = collection?.products.nodes ?? [];
  if (products.length === 0) return null;

  return (
    <section className="section gd-shop" aria-labelledby="gd-shop-h">
      <div className="container">
        <div className="gd-shop-grid">
          <div className="gd-shop-cta">
            <div className="eyebrow">Ready to shop?</div>
            <h2 id="gd-shop-h" className="h2">Find your match in 2 minutes.</h2>
            <p>
              Skip the comparison shopping. Answer a few questions and we&apos;ll narrow
              it down to the mattresses that actually fit your sleep style.
            </p>
            <div className="gd-shop-cta-actions">
              <Link href="/sleep-quiz" className="btn btn-primary btn-lg">
                Take the sleep quiz <Icon name="arrow-right" size={16} />
              </Link>
              <Link href="/pages/mattress-store-locations" className="btn btn-ghost btn-lg">
                Or visit a showroom
              </Link>
            </div>
          </div>
        </div>
      </div>
      <RelatedRail
        products={products}
        eyebrow="Best sellers"
        heading="Shop the picks"
        railId="article-shop-rail"
      />
    </section>
  );
}
