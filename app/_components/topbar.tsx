import Link from 'next/link';
import { Icon } from './icon';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

export function TopBar() {
  // Trust messages (free delivery / 0% APR / 120-night) are owned by the
  // .trust-strip below the nav. The topbar carries only utility links so we
  // don't render the same trust trio twice in the first 100px of every page.
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <div className="topbar-marquee">
          <span><Icon name="pin" size={13} /> 5 LA showrooms — open daily</span>
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
