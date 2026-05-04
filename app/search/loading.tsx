export default function SearchLoading() {
  return (
    <main className="container plp" aria-busy="true">
      <header className="lp-hero" style={{ paddingBottom: 'var(--s-5)' }}>
        <div className="skel skel-line" style={{ width: 160, marginTop: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
        <div className="skel" style={{ height: 44, width: '70%', marginTop: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
        <div className="skel" style={{ height: 60, width: '100%', maxWidth: 640, marginTop: 'var(--s-5)', borderRadius: 999 }} aria-hidden>&nbsp;</div>
      </header>
      <section className="section">
        <div className="plp-toolbar">
          <span className="skel skel-line" style={{ width: 120 }} aria-hidden>&nbsp;</span>
        </div>
        <div className="plp-grid">
          {Array.from({ length: 6 }).map((_, i) => (
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
