export default function CollectionLoading() {
  return (
    <main className="container plp">
      <header className="lp-hero">
        <div className="skel skel-line" style={{ width: 220, marginTop: 'var(--s-4)' }} aria-hidden>
          &nbsp;
        </div>
        <div className="skel" style={{ height: 48, width: '60%', marginTop: 'var(--s-5)' }} aria-hidden>
          &nbsp;
        </div>
        <div className="skel skel-line" style={{ width: '90%', maxWidth: 520, marginTop: 'var(--s-4)' }} aria-hidden>
          &nbsp;
        </div>
      </header>

      <section className="section" aria-busy="true" aria-label="Loading products">
        <div className="plp-toolbar">
          <span className="skel skel-line" style={{ width: 140 }} aria-hidden>&nbsp;</span>
          <span className="skel" style={{ height: 36, width: 200, borderRadius: 999 }} aria-hidden>&nbsp;</span>
        </div>
        <div className="plp-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="pcard plp-card" style={{ pointerEvents: 'none' }}>
              <div className="skel skel-block" />
              <div className="pcard-meta">
                <div className="skel skel-line" style={{ width: '40%' }} aria-hidden>&nbsp;</div>
                <div className="skel skel-line" style={{ width: '85%', marginTop: 6 }} aria-hidden>&nbsp;</div>
                <div className="skel skel-line" style={{ width: '50%', marginTop: 6 }} aria-hidden>&nbsp;</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
