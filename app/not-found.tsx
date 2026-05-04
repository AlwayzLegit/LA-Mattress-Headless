import Link from 'next/link';
import { Icon } from './_components/icon';

export default function NotFound() {
  return (
    <main className="container" style={{ padding: 'var(--s-10) 0' }}>
      <div style={{ maxWidth: 720 }}>
        <div className="eyebrow">404</div>
        <h1 className="h-display" style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>
          Lost in<br />the night.
        </h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.5, maxWidth: '50ch', marginBottom: 'var(--s-6)' }}>
          The page you’re looking for doesn’t exist — maybe a discontinued product or an old promotion. Try one of these instead:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          <li><Link href="/" className="link-arrow">Home <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/collections/mattresses" className="link-arrow">Shop all mattresses <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/collections/on-sale" className="link-arrow">Current sale <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/pages/mattress-store-locations" className="link-arrow">Find a store <Icon name="arrow-right" size={14} /></Link></li>
          <li><a href="tel:+12135550142" className="link-arrow">Call us at (213) 555-0142 <Icon name="phone" size={14} /></a></li>
        </ul>
      </div>
    </main>
  );
}
