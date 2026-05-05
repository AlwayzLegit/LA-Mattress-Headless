import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Account — LA Mattress Store',
  description: 'Manage your LA Mattress Store orders and account.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/account' },
};

export default function AccountPage() {
  return (
    <main className="container" style={{ padding: 'var(--s-8) 0 var(--s-9)' }}>
      <div style={{ maxWidth: 640 }}>
        <nav className="lp-breadcrumbs">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <span>Account</span>
        </nav>
        <div className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>Account</div>
        <h1 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>
          Order lookup &amp; account.
        </h1>
        <p className="muted" style={{ fontSize: 17, lineHeight: 1.55, maxWidth: '52ch', marginBottom: 'var(--s-5)' }}>
          Order tracking and account management live on our secure checkout subdomain. We&rsquo;re
          rolling out a unified account experience here soon.
        </p>

        <div
          style={{
            padding: 'var(--s-5)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-3)',
            background: 'var(--surface)',
            marginBottom: 'var(--s-6)',
          }}
        >
          <div className="eyebrow">Need help with an order?</div>
          <p style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>
            For order status, delivery scheduling, exchanges, or warranty claims, reach our team
            directly — most questions are resolved on the first call.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
            <a href={`tel:${SITE_PHONE_TEL}`} className="btn btn-primary">
              <Icon name="phone" size={14} /> Call {SITE_PHONE_DISPLAY}
            </a>
            <Link href="/pages/mattress-store-contact" className="btn btn-ghost">
              Contact us
            </Link>
            <Link href="/pages/mattress-store-locations" className="btn btn-ghost">
              Visit a showroom
            </Link>
          </div>
        </div>

        <div className="eyebrow">Useful links</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--s-3) 0 var(--s-7)', display: 'grid', gap: 'var(--s-3)' }}>
          <li><Link href="/pages/mattress-store-delivery" className="link-arrow">Delivery &amp; setup <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/pages/love-your-bed-guarantee" className="link-arrow">120-night exchange <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/pages/warranty" className="link-arrow">Warranty coverage <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/pages/mattress-store-financing" className="link-arrow">Financing options <Icon name="arrow-right" size={14} /></Link></li>
        </ul>
      </div>
    </main>
  );
}
