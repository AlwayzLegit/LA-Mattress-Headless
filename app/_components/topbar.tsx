import Link from 'next/link';
import { Icon } from './icon';

export function TopBar() {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <div className="topbar-marquee">
          <span><Icon name="truck" size={14} /> Free white glove delivery</span>
          <span className="topbar-dot">·</span>
          <span><Icon name="card" size={14} /> 0% APR financing available</span>
          <span className="topbar-dot">·</span>
          <span><Icon name="shield" size={14} /> 120-night comfort exchange</span>
        </div>
        <div className="topbar-right">
          <Link href="/pages/mattress-store-locations" className="topbar-link"><Icon name="pin" size={13} /> Find a store</Link>
          <span className="topbar-sep" />
          <a href="tel:+12135550142" className="topbar-link"><Icon name="phone" size={13} /> (213) 555-0142</a>
        </div>
      </div>
    </div>
  );
}
