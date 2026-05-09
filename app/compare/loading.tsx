/**
 * Loading skeleton for /compare. Mirrors the live page structure:
 * breadcrumb + hero copy + 4-col compare-table shell. Spec rows
 * skeletonized so the layout doesn't reshuffle when the actual
 * Storefront product fetches resolve.
 */
export default function CompareLoading() {
  const cols = 4;
  const rows = 8;
  return (
    <main className="container compare-page" aria-busy="true">
      <div className="skel skel-line" style={{ width: 80, marginTop: 'var(--s-5)' }} aria-hidden>&nbsp;</div>
      <header className="compare-header" style={{ marginTop: 'var(--s-4)' }}>
        <div className="skel skel-line" style={{ width: 120, marginBottom: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
        <div className="skel" style={{ height: 36, width: '60%', maxWidth: 360, marginBottom: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
        <div className="skel skel-line" style={{ width: '70%', maxWidth: 480 }} aria-hidden>&nbsp;</div>
      </header>
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-row-label">&nbsp;</th>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="compare-product-cell">
                  <div className="skel" style={{ width: '100%', aspectRatio: '1' }} aria-hidden>&nbsp;</div>
                  <div className="skel skel-line" style={{ width: '60%', marginTop: 'var(--s-3)' }} aria-hidden>&nbsp;</div>
                  <div className="skel skel-line" style={{ width: '90%', marginTop: 6 }} aria-hidden>&nbsp;</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                <th scope="row" className="compare-row-label">
                  <div className="skel skel-line" style={{ width: 80 }} aria-hidden>&nbsp;</div>
                </th>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}>
                    <div className="skel skel-line" style={{ width: r % 3 === 0 ? '50%' : '70%' }} aria-hidden>&nbsp;</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
