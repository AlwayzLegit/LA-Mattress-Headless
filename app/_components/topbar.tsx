import Link from 'next/link';
import { Icon } from './icon';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

export function TopBar() {
  // Slim navy utility bar: Find a store + phone only. The trust claims
  // that used to sit on the left now live in the sitewide <TrustStrip>
  // rendered under the nav on every page (de-duped to avoid the same
  // three claims appearing twice on desktop). Hidden on <=768px
  // viewports via the `.topbar { display: none }` media rule.
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <span className="topbar-tagline">Los Angeles&rsquo; mattress store &mdash; 5 showrooms, family-owned since 2012</span>
        <div className="topbar-right">
          <Link href="/pages/mattress-store-locations" className="topbar-link"><Icon name="pin" size={13} /> Find a store</Link>
          <span className="topbar-sep" />
          <a href={`tel:${SITE_PHONE_TEL}`} className="topbar-link"><Icon name="phone" size={13} /> {SITE_PHONE_DISPLAY}</a>
        </div>
      </div>
    </div>
  );
}
