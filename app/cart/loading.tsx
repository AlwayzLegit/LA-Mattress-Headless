export default function CartLoading() {
  return (
    <main className="container" style={{ padding: 'var(--s-7) 0 var(--s-9)' }} aria-busy="true">
      <div className="skel skel-line" style={{ width: 80, marginBottom: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
      <div className="skel" style={{ height: 40, width: '40%', marginBottom: 'var(--s-6)' }} aria-hidden>&nbsp;</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 'var(--s-6)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--s-4)' }}>
              <div className="skel" style={{ width: 140, aspectRatio: '1' }} aria-hidden>&nbsp;</div>
              <div style={{ flex: 1 }}>
                <div className="skel skel-line" style={{ width: '70%' }} aria-hidden>&nbsp;</div>
                <div className="skel skel-line" style={{ width: '30%', marginTop: 8 }} aria-hidden>&nbsp;</div>
                <div className="skel" style={{ height: 36, width: 140, marginTop: 'var(--s-3)', borderRadius: 999 }} aria-hidden>&nbsp;</div>
              </div>
            </div>
          ))}
        </div>
        <aside className="skel" style={{ height: 240, borderRadius: 'var(--r-3)' }} aria-hidden>&nbsp;</aside>
      </div>
    </main>
  );
}
