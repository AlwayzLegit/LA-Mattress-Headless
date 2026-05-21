// Skeleton shown by the page-internal <Suspense> in
// app/blogs/[blog]/[article]/page.tsx during navigation. Mirrors the
// design's Guide detail layout: gd-head + 3-col gd-article (TOC / body /
// side). Same Phase-19 pattern — shown for handles in the inventory
// snapshot, bypassed for unknown handles so notFound() emits a real 404.

export function ArticleSkeleton() {
  return (
    <div aria-busy="true">
      <section className="gd-head">
        <div className="container">
          <div className="skel skel-line" style={{ width: 240, marginBottom: 'var(--s-5)' }} aria-hidden>&nbsp;</div>
          <div className="gd-head-inner">
            <div className="skel skel-line" style={{ width: 200, marginBottom: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
            <div className="skel" style={{ height: 56, width: '90%', maxWidth: 720, marginBottom: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
            <div className="skel" style={{ height: 56, width: '70%', maxWidth: 540, marginBottom: 'var(--s-4)' }} aria-hidden>&nbsp;</div>
            <div className="skel skel-line" style={{ width: '60%', maxWidth: 480 }} aria-hidden>&nbsp;</div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="gd-article">
          <aside aria-hidden>
            <div className="skel skel-line" style={{ width: 80, marginBottom: 'var(--s-3)' }}>&nbsp;</div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skel skel-line" style={{ width: i % 2 ? '70%' : '90%', marginBottom: 8 }}>&nbsp;</div>
            ))}
          </aside>
          <article style={{ maxWidth: '64ch', display: 'grid', gap: 12 }} aria-hidden>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="skel skel-line"
                style={{ width: i % 3 === 2 ? '60%' : '95%' }}
              >&nbsp;</div>
            ))}
          </article>
          <aside aria-hidden>
            <div className="skel" style={{ height: 180, borderRadius: 'var(--r-3)' }}>&nbsp;</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
