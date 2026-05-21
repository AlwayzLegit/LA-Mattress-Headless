/**
 * Loading skeleton for `/search`. Mirrors the route's actual structure
 * post-Phase 101 (lp-hero with stacked copy, bucket tabs, then either
 * the All-tab stacked sections OR a paginated bucket grid).
 *
 * The All tab is the default landing, so we render its visual: three
 * bucket headers with grids (Mattresses 6 cards / Showrooms 2 cards
 * / Articles 4 cards). Brief flash on a fast-resolving query but
 * accurate for slow connections — avoids the layout reshuffle the
 * old skeleton (single grid only) caused when the actual page
 * arrived.
 */
export default function SearchLoading() {
  return (
    <main className="container plp" aria-busy="true">
      <section className="lp-hero" style={{ paddingBottom: 'var(--s-5)' }}>
        <div className="skel skel-line" style={{ width: 120, marginTop: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
        <div className="lp-hero-inner lp-hero-inner-stacked" style={{ marginTop: 'var(--s-5)' }}>
          <div className="lp-hero-copy">
            <div className="skel skel-line" style={{ width: 64, marginBottom: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
            <div className="skel" style={{ height: 44, width: '70%', maxWidth: 480 }} aria-hidden>&nbsp;</div>
            <div className="skel" style={{ height: 56, width: '100%', maxWidth: 640, marginTop: 'var(--s-5)', borderRadius: 'var(--r-pill)' }} aria-hidden>&nbsp;</div>
          </div>
        </div>
      </section>

      <section className="section plp-section">
        <nav className="search-tabs" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="search-tab" style={{ pointerEvents: 'none' }}>
              <span className="skel skel-line" style={{ width: 60, height: 14 }}>&nbsp;</span>
              <span className="skel skel-line" style={{ width: 18, height: 12 }}>&nbsp;</span>
            </span>
          ))}
        </nav>

        <div className="search-all">
          <BucketSkeleton title="Mattresses" gridClass="plp-grid" cards={6} kind="product" />
          <BucketSkeleton title="Showrooms"  gridClass="search-showroom-grid" cards={2} kind="showroom" />
          <BucketSkeleton title="Articles"   gridClass="gd-grid" cards={4} kind="article" />
        </div>
      </section>
    </main>
  );
}

function BucketSkeleton({
  title,
  gridClass,
  cards,
  kind,
}: {
  title: string;
  gridClass: string;
  cards: number;
  kind: 'product' | 'showroom' | 'article';
}) {
  return (
    <section className="search-all-bucket" aria-label={`Loading ${title}`}>
      <div className="search-all-head">
        <div className="skel" style={{ height: 28, width: 180 }} aria-hidden>&nbsp;</div>
        <div className="skel skel-line" style={{ width: 100 }} aria-hidden>&nbsp;</div>
      </div>
      <div className={gridClass}>
        {Array.from({ length: cards }).map((_, i) => {
          if (kind === 'showroom') {
            return (
              <div key={i} className="search-showroom-card" style={{ pointerEvents: 'none' }}>
                <div className="skel" style={{ aspectRatio: '4 / 3' }} aria-hidden>&nbsp;</div>
                <div className="search-showroom-body">
                  <div className="skel skel-line" style={{ width: '40%' }} aria-hidden>&nbsp;</div>
                  <div className="skel skel-line" style={{ width: '85%', marginTop: 6 }} aria-hidden>&nbsp;</div>
                  <div className="skel skel-line" style={{ width: '70%', marginTop: 6 }} aria-hidden>&nbsp;</div>
                </div>
              </div>
            );
          }
          if (kind === 'article') {
            return (
              <div key={i} className="gd-card" style={{ pointerEvents: 'none' }}>
                <div className="skel gd-card-img" aria-hidden>&nbsp;</div>
                <div className="gd-card-body">
                  <div className="skel skel-line" style={{ width: '50%' }} aria-hidden>&nbsp;</div>
                  <div className="skel skel-line" style={{ width: '90%', marginTop: 8 }} aria-hidden>&nbsp;</div>
                  <div className="skel skel-line" style={{ width: '60%', marginTop: 6 }} aria-hidden>&nbsp;</div>
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="pcard plp-card" style={{ pointerEvents: 'none' }}>
              <div className="skel skel-block" aria-hidden>&nbsp;</div>
              <div className="pcard-meta">
                <div className="skel skel-line" style={{ width: '40%' }} aria-hidden>&nbsp;</div>
                <div className="skel skel-line" style={{ width: '85%', marginTop: 6 }} aria-hidden>&nbsp;</div>
                <div className="skel skel-line" style={{ width: '50%', marginTop: 6 }} aria-hidden>&nbsp;</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
