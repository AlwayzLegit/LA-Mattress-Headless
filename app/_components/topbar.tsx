import Link from 'next/link';
import { Icon } from './icon';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

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
          <a href={`tel:${SITE_PHONE_TEL}`} className="topbar-link"><Icon name="phone" size={13} /> {SITE_PHONE_DISPLAY}</a>
        </div>
      </div>
    </div>
  );
}
