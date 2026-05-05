// Skeleton shown by the page-internal <Suspense> in app/blogs/[blog]/[article]/page.tsx
// during navigation. Same Phase-19 pattern as PDP/PLP: shown for handles that
// are in our inventory snapshot, bypassed for unknown handles so notFound()
// can emit a real HTTP 404.

export function ArticleSkeleton() {
  return (
    <main className="container article-page" style={{ padding: 'var(--s-7) 0 var(--s-9)' }} aria-busy="true">
      <div className="skel skel-line" style={{ width: 200, marginBottom: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
      <div className="skel skel-line" style={{ width: 140, marginBottom: 'var(--s-5)' }} aria-hidden>&nbsp;</div>

      <div className="skel" style={{ height: 48, width: '85%', maxWidth: 720, marginBottom: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
      <div className="skel" style={{ height: 48, width: '60%', maxWidth: 540, marginBottom: 'var(--s-6)' }} aria-hidden>&nbsp;</div>

      <div className="skel" style={{ aspectRatio: '16 / 9', maxWidth: 880, borderRadius: 'var(--r-3)', marginBottom: 'var(--s-7)' }} aria-hidden>&nbsp;</div>

      <div style={{ maxWidth: 720, display: 'grid', gap: 12 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="skel skel-line"
            style={{ width: i % 3 === 2 ? '60%' : '95%' }}
            aria-hidden
          >&nbsp;</div>
        ))}
      </div>
    </main>
  );
}
