import Link from 'next/link';
import { Icon } from './icon';

const ITEMS = [
  { icon: 'truck' as const,  label: 'Free white-glove delivery', href: '/pages/mattress-store-delivery' },
  { icon: 'shield' as const, label: '120-night comfort exchange', href: '/pages/love-your-bed-guarantee' },
  { icon: 'card' as const,   label: '0% APR financing',           href: '/pages/mattress-store-financing' },
  { icon: 'pin' as const,    label: '5 LA showrooms',             href: '/pages/mattress-store-locations' },
];

/**
 * Slim sitewide trust bar. Rendered in the root layout directly under
 * <Nav> on every page (static — scrolls away with content). Each claim
 * is an interlink to its proof page, reinforcing the four
 * conversion-meaningful benefits everywhere (PLP, PDP, blog, cart…).
 * The pre-header TopBar no longer repeats these (de-duped).
 *
 * Mobile: horizontal scroll-snap rail. Desktop: 4 even columns.
 */
export function TrustStrip() {
  return (
    <nav className="trust-strip" aria-label="Store benefits">
      <div className="trust-strip-inner">
        {ITEMS.map((it) => (
          <Link key={it.label} href={it.href} className="trust-strip-item">
            <Icon name={it.icon} size={16} />
            <span>{it.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
