import Link from 'next/link';
import { Icon } from '../icon';

/**
 * "Shop by neighborhood" rail — promotes 12 high-intent LA neighborhood
 * landing pages from depth 3 to depth 2 (one click from the homepage),
 * distributing link equity from the highest-authority page to the local
 * landing cluster.
 *
 * Why these 12: each is a Semrush-verified "mattress store [neighborhood]"
 * query with measurable volume, and the set is balanced across all 5
 * physical showrooms so every store sees inbound link flow from the
 * homepage. Pasadena (260/mo) is the largest single phrase, followed
 * by Santa Monica / Venice / Burbank / Glendale at 70–90/mo. We
 * deliberately keep this set small — a 73-link homepage rail would
 * dilute equity and look like spam. Other neighborhoods remain reachable
 * via the locations index + their per-neighborhood internal-link rails.
 *
 * Companion to local-SEO audit finding #8 (homepage neighborhood rail);
 * pairs with the existing Showrooms section (depth-1 to 5 showrooms)
 * to give the homepage two complementary local link surfaces.
 */
const NEIGHBORHOODS: { name: string; handle: string; showroom: string }[] = [
  // West LA / La Brea cluster (Westside + Mid-City)
  { name: 'Beverly Hills',  handle: 'mattress-store-beverly-hills',  showroom: 'West LA / La Brea' },
  { name: 'Santa Monica',   handle: 'mattress-store-santa-monica',   showroom: 'West LA' },
  { name: 'Venice',         handle: 'mattress-store-venice',         showroom: 'West LA' },
  { name: 'Culver City',    handle: 'mattress-store-culver-city',    showroom: 'West LA' },
  { name: 'Hollywood',      handle: 'mattress-store-hollywood',      showroom: 'La Brea / Koreatown' },
  // Koreatown cluster (Central LA)
  { name: 'Downtown LA',    handle: 'mattress-store-downtown-la',    showroom: 'Koreatown / La Brea' },
  { name: 'West Hollywood', handle: 'mattress-store-west-hollywood', showroom: 'La Brea' },
  // Studio City cluster (San Fernando Valley)
  { name: 'Sherman Oaks',   handle: 'mattress-store-sherman-oaks',   showroom: 'Studio City' },
  { name: 'Burbank',        handle: 'mattress-store-burbank',        showroom: 'Studio City / Glendale' },
  { name: 'Encino',         handle: 'mattress-store-encino',         showroom: 'Studio City' },
  // Glendale cluster (San Gabriel Valley)
  { name: 'Pasadena',       handle: 'mattress-store-pasadena',       showroom: 'Glendale' },
  { name: 'Long Beach',     handle: 'mattress-store-long-beach',     showroom: 'West LA / Koreatown' },
];

export function ShopByNeighborhood() {
  return (
    <section className="section shop-by-neighborhood" aria-labelledby="sbn-h">
      <div className="container">
        <header className="shop-by-neighborhood-head">
          <div className="eyebrow">Free white-glove delivery</div>
          <h2 id="sbn-h" className="h2">Shop mattresses near your neighborhood.</h2>
          <p className="muted shop-by-neighborhood-lede">
            Free same-day mattress delivery across Los Angeles, same brands, same prices,
            same service, whether you&rsquo;re in Beverly Hills, Pasadena, or Long Beach.
            Pick your neighborhood to see your nearest showroom.
          </p>
        </header>
        <ul className="shop-by-neighborhood-grid" role="list">
          {NEIGHBORHOODS.map((n) => (
            <li key={n.handle} className="shop-by-neighborhood-item">
              <Link href={`/pages/${n.handle}`} className="shop-by-neighborhood-link">
                <span className="shop-by-neighborhood-name">{n.name}</span>
                <span className="shop-by-neighborhood-store muted">{n.showroom}</span>
                <span className="shop-by-neighborhood-arrow" aria-hidden="true">
                  <Icon name="arrow-right" size={14} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="shop-by-neighborhood-foot">
          <Link href="/pages/mattress-store-locations" className="link-arrow">
            See all neighborhoods we serve <Icon name="arrow-right" size={14} />
          </Link>
        </p>
      </div>
    </section>
  );
}
