// Skeleton shown by the page-internal <Suspense> in app/products/[handle]/page.tsx
// during navigation between PDPs. NOT a route-level loading.tsx — that wraps
// the route in an implicit Suspense which swallows notFound() and emits 200
// with the not-found body (Phase 14 root cause). Keeping this as a regular
// component lets notFound() bubble cleanly while still showing a skeleton on
// route transitions.

export function ProductSkeleton() {
  return (
    <main className="container" style={{ padding: 'var(--s-6) 0 var(--s-9)' }} aria-busy="true">
      <div className="skel skel-line" style={{ width: 240, marginBottom: 'var(--s-5)' }} aria-hidden>&nbsp;</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)',
          gap: 'var(--s-7)',
        }}
      >
        <div>
          <div className="skel" style={{ aspectRatio: '1', borderRadius: 'var(--r-3)' }} aria-hidden>&nbsp;</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skel" style={{ aspectRatio: '1', borderRadius: 'var(--r-2)' }} aria-hidden>&nbsp;</div>
            ))}
          </div>
        </div>
        <aside>
          <div className="skel skel-line" style={{ width: '40%' }} aria-hidden>&nbsp;</div>
          <div className="skel" style={{ height: 36, width: '85%', marginTop: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
          <div className="skel skel-line" style={{ width: '30%', height: 28, marginTop: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
          <div className="skel skel-line" style={{ width: '100%', marginTop: 'var(--s-5)' }} aria-hidden>&nbsp;</div>
          <div className="skel skel-line" style={{ width: '90%', marginTop: 8 }} aria-hidden>&nbsp;</div>
          <div className="skel skel-line" style={{ width: '95%', marginTop: 8 }} aria-hidden>&nbsp;</div>
          <div style={{ display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-5)', flexWrap: 'wrap' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skel" style={{ height: 36, width: 80, borderRadius: 999 }} aria-hidden>&nbsp;</div>
            ))}
          </div>
          <div className="skel" style={{ height: 48, width: '100%', marginTop: 'var(--s-5)', borderRadius: 999 }} aria-hidden>&nbsp;</div>
        </aside>
      </div>
    </main>
  );
}
