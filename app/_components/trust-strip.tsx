import { Icon } from './icon';

const ITEMS = [
  { icon: 'truck' as const,  label: 'Free white-glove delivery' },
  { icon: 'shield' as const, label: '120-night comfort exchange' },
  { icon: 'card' as const,   label: '0% APR financing available' },
  { icon: 'pin' as const,    label: '5 LA showrooms — open daily' },
];

/**
 * Slim sitewide value-prop band. Sits between the main nav and page content.
 * Reinforces the four conversion-meaningful claims on every page so visitors
 * who skip the PDP buy box still see them on PLP, search, blog, etc.
 *
 * Mobile: horizontal scroll-snap rail (visible items wrap to next).
 * Desktop: 4 evenly spaced columns, no scroll.
 */
export function TrustStrip() {
  return (
    <div className="trust-strip" role="region" aria-label="Store benefits">
      <div className="trust-strip-inner">
        {ITEMS.map((it) => (
          <div key={it.label} className="trust-strip-item">
            <Icon name={it.icon} size={16} />
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
