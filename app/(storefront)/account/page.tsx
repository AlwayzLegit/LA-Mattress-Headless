import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';
import { RecentlyViewedRail } from '@/app/_components/recently-viewed';
import { AccountSavedCount } from './saved-count';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

export const metadata: Metadata = {
  title: { absolute: 'Your Account · LA Mattress Store' },
  description: 'Manage your LA Mattress Store orders and account.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/account' },
};

/**
 * Pre-customer-account placeholder. Until the unified account
 * experience lives natively in this storefront, /account serves as
 * a landing for the localStorage surfaces a visitor already has
 * — saved mattresses (wishlist), recently-viewed rail — plus
 * order-help routing (call / contact / showroom). Order tracking
 * is currently on the Shopify checkout subdomain.
 */
export default function AccountPage() {
  return (
    <main className="container" style={{ paddingTop: 'var(--s-8)', paddingBottom: 'var(--s-9)' }}>
      <div style={{ maxWidth: 640 }}>
        <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span>Account</span>
        </nav>
        <div className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>Account</div>
        <h1 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>
          Your shortlist &amp; order help.
        </h1>
        <p className="muted" style={{ fontSize: 17, lineHeight: 1.55, maxWidth: '52ch', marginBottom: 'var(--s-6)' }}>
          Order tracking and account management live on our secure checkout subdomain.
          A unified account experience here is in the works — until then, your saved
          mattresses and recently-viewed list live below.
        </p>

        <div className="account-tiles">
          <Link href="/wishlist" className="account-tile">
            <div className="account-tile-icon"><Icon name="heart" size={22} /></div>
            <div className="account-tile-body">
              <div className="account-tile-label">Saved mattresses</div>
              <AccountSavedCount />
            </div>
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/compare" className="account-tile">
            <div className="account-tile-icon"><Icon name="check" size={22} /></div>
            <div className="account-tile-body">
              <div className="account-tile-label">Compare set</div>
              <div className="account-tile-sub muted">Side-by-side specs for up to 4</div>
            </div>
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/cart" className="account-tile">
            <div className="account-tile-icon"><Icon name="cart" size={22} /></div>
            <div className="account-tile-body">
              <div className="account-tile-label">Cart</div>
              <div className="account-tile-sub muted">Review what you&rsquo;re buying</div>
            </div>
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/sleep-quiz" className="account-tile">
            <div className="account-tile-icon"><Icon name="bed" size={22} /></div>
            <div className="account-tile-body">
              <div className="account-tile-label">Sleep quiz</div>
              <div className="account-tile-sub muted">8 questions, get a match</div>
            </div>
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>

        <div
          style={{
            padding: 'var(--s-5)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-3)',
            background: 'var(--surface)',
            marginTop: 'var(--s-6)',
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

      {/* Pull the visitor back into shopping with whatever they were
          last looking at. Renders nothing if there are <2 entries
          (the rail's own gating). */}
      <RecentlyViewedRail
        heading="Pick up where you left off"
        eyebrow="Recently viewed"
      />
    </main>
  );
}
