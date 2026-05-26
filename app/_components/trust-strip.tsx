import Link from 'next/link';
import { Icon, type IconName } from './icon';
import { getTrustItems } from '@/lib/shopify';

/**
 * Hardcoded fallback — used only when the live `trust_item`
 * metaobjects fetch returns empty (Shopify unconfigured, unreachable,
 * or no entries seeded). Merchant edits in Shopify Admin → Content →
 * Metaobjects → Trust strip item propagate within one ISR cycle.
 */
const FALLBACK_ITEMS: { icon: IconName; label: string; href: string }[] = [
  { icon: 'truck',  label: 'Free white-glove delivery', href: '/pages/mattress-store-delivery' },
  { icon: 'shield', label: '120-night comfort exchange', href: '/pages/love-your-bed-guarantee' },
  { icon: 'card',   label: '0% APR financing',           href: '/pages/mattress-store-financing' },
  { icon: 'pin',    label: '5 LA showrooms',             href: '/pages/mattress-store-locations' },
];

// IconName is a string-literal union; the metaobject stores an icon
// name as plain text, so we narrow it before render to keep TS happy
// and to silently drop typo'd icons rather than crash the bar.
const KNOWN_ICONS: ReadonlySet<IconName> = new Set<IconName>([
  'search','user','cart','pin','phone','arrow-right','arrow-left','arrow-up-right',
  'chevron-down','chevron-right','menu','close','star','truck','shield','sparkle','card',
  'home','check','plus','minus','pause','play','heart','mail','bed','alert','lock','chat',
]);

function asIcon(value: string): IconName {
  return KNOWN_ICONS.has(value as IconName) ? (value as IconName) : 'check';
}

/**
 * Slim sitewide trust bar. Rendered in the root layout directly under
 * <Nav> on every page (static — scrolls away with content). Each claim
 * is an interlink to its proof page, reinforcing the conversion-
 * meaningful benefits everywhere (PLP, PDP, blog, cart…).
 *
 * Live items come from the `trust_item` Shopify metaobject; merchant
 * can rewrite copy / swap proof URLs / reorder via Admin without a
 * code change. Falls back to FALLBACK_ITEMS on empty fetch.
 *
 * Mobile: horizontal scroll-snap rail. Desktop: 4 even columns.
 */
export async function TrustStrip() {
  const live = await getTrustItems();
  const items = live.length > 0
    ? live.map((it) => ({ icon: asIcon(it.icon), label: it.label, href: it.href }))
    : FALLBACK_ITEMS;
  return (
    <nav className="trust-strip" aria-label="Store benefits">
      <div className="trust-strip-inner">
        {items.map((it) => (
          <Link key={it.label} href={it.href} className="trust-strip-item">
            <Icon name={it.icon} size={16} />
            <span>{it.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
