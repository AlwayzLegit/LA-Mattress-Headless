import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminSidebar } from './_components/sidebar';
import { AdminToolbar } from './_components/admin-toolbar';
import './admin.css';

/**
 * Shared chrome for every route under /admin: left-rail sidebar +
 * sticky top toolbar (date-range picker + refresh button).
 *
 * The toolbar lives here rather than in each page because (a) the
 * shared chrome is what makes the per-section split feel like one
 * cohesive dashboard rather than 8 disjoint pages, and (b) repeating
 * it in every page.tsx invites drift.
 *
 * Suspense fallback on the toolbar covers the very first render
 * before client-side useSearchParams resolves — without it Next.js
 * warns that useSearchParams should be wrapped.
 */
export const metadata: Metadata = {
  title: 'Dashboard — LA Mattress Internal',
  robots: { index: false, follow: false, nocache: true, noimageindex: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-shell">
      <AdminSidebar />
      <div className="dash-main">
        <Suspense fallback={<div className="dash-toolbar" aria-hidden="true" />}>
          <AdminToolbar />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
