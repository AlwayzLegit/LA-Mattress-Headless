/**
 * Loading skeleton for Shopify CMS pages. Mirrors the default render
 * (breadcrumb + h1 + body paragraphs). The showroom + locations
 * variants have richer layouts but block on the same getPageByHandle
 * call as the default — a generic body-paragraph skeleton avoids a
 * 100ms flash of nothing on slow connections.
 */
export default function PageLoading() {
  return (
    <main className="container" aria-busy="true">
      <article className="cms-page" style={{ padding: 'var(--s-8) 0' }}>
        <div className="skel skel-line" style={{ width: 200, marginBottom: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
        <div className="skel" style={{ height: 44, width: '70%', maxWidth: 540, marginBottom: 'var(--s-6)' }} aria-hidden>&nbsp;</div>
        <div style={{ maxWidth: 720, display: 'grid', gap: 12 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="skel skel-line"
              style={{ width: i % 4 === 3 ? '55%' : '95%' }}
              aria-hidden
            >&nbsp;</div>
          ))}
        </div>
      </article>
    </main>
  );
}
