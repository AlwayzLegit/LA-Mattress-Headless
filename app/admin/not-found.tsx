import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Admin-tree not-found page.
 *
 * Renders when any /admin/* segment hits notFound() — most commonly
 * /admin/orders/<not-a-number> after the route's regex guard. Uses
 * the bare root layout (no storefront chrome) and the dashboard's
 * .dashboard utility class so the page reads as part of the same
 * internal tool rather than landing on the generic Next.js 404.
 *
 * QA round 2 polish item.
 */

export const metadata: Metadata = {
  title: 'Not found — LA Mattress Internal',
  robots: { index: false, follow: false, nocache: true, noimageindex: true },
};

export default function AdminNotFound() {
  return (
    <main className="dashboard">
      <header className="dashboard-head">
        <div>
          <div className="eyebrow">Internal</div>
          <h1 className="h2" style={{ margin: 0 }}>Not found</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            <Link href="/admin">← Back to dashboard</Link>
          </p>
        </div>
      </header>
      <section className="dash-section">
        <div className="dash-card">
          <p className="muted" style={{ marginTop: 0 }}>
            The page you&rsquo;re looking for doesn&rsquo;t exist on the admin tree.
            Check the URL or follow the link above to return to the dashboard.
          </p>
        </div>
      </section>
    </main>
  );
}
