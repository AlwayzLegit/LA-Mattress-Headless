// Skeleton shown by the page-internal <Suspense> in app/collections/[handle]/page.tsx
// during navigation between PLPs and on filter/sort changes. See sibling
// app/products/[handle]/skeleton.tsx for the rationale (route-level loading.tsx
// swallows notFound()).

export function CollectionSkeleton() {
  return (
    <main className="container plp" aria-busy="true">
      <header className="plp-header" style={{ paddingTop: 'var(--s-6)' }}>
        <div className="skel skel-line" style={{ width: 200, marginBottom: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
        <div className="skel" style={{ height: 36, width: '60%', maxWidth: 480, marginBottom: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
        <div className="skel skel-line" style={{ width: '85%', maxWidth: 720 }} aria-hidden>&nbsp;</div>
        <div className="skel skel-line" style={{ width: '70%', maxWidth: 600, marginTop: 8 }} aria-hidden>&nbsp;</div>
      </header>
      <div className="plp-toolbar" style={{ marginTop: 'var(--s-5)', display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
        <div className="skel" style={{ height: 36, width: 120, borderRadius: 999 }} aria-hidden>&nbsp;</div>
        <div className="skel" style={{ height: 36, width: 160, borderRadius: 999 }} aria-hidden>&nbsp;</div>
        <div className="skel" style={{ height: 36, width: 140, borderRadius: 999 }} aria-hidden>&nbsp;</div>
      </div>
      <div className="plp-grid" style={{ marginTop: 'var(--s-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--s-5)' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="skel" style={{ aspectRatio: '4 / 5', borderRadius: 'var(--r-3)' }} aria-hidden>&nbsp;</div>
            <div className="skel skel-line" style={{ width: '60%', marginTop: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
            <div className="skel skel-line" style={{ width: '85%', marginTop: 8 }} aria-hidden>&nbsp;</div>
            <div className="skel skel-line" style={{ width: '40%', marginTop: 8 }} aria-hidden>&nbsp;</div>
          </div>
        ))}
      </div>
    </main>
  );
}
