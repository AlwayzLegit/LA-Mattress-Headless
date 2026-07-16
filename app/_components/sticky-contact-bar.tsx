'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { track } from '@/lib/analytics';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';

/**
 * Sitewide MOBILE sticky call + directions bar (Round 15).
 *
 * For a 5-showroom store the two highest-value online conversions are a
 * phone call and a drive to a showroom (Round 12 instrumented
 * phone_click / directions_click for exactly this; the data justified
 * building the bar). The TopBar's call/find-a-store links are
 * desktop-only (hidden < 768px), so mobile visitors had no persistent
 * path to either — this bar fills that gap.
 *
 * - Call → tel: the primary store number. The delegated listener in
 *   contact-click-tracker.tsx auto-fires phone_click for any tel: link,
 *   so no analytics wiring is needed here.
 * - Find a store → the locations finder (best UX for 5 showrooms: the
 *   visitor picks the nearest). That's an internal link, so it does NOT
 *   match the tracker's maps-URL regex — we fire directions_click
 *   explicitly on click. No double-count (internal href never matches
 *   the delegated matcher).
 *
 * Mobile-only via CSS (.sticky-contact-bar is display:none until the
 * 768px breakpoint). Suppressed on /admin, /account, /checkout, and
 * /products/* — the PDP already owns the bottom edge with its sticky
 * add-to-cart bar (.pdp-sticky-bar), so we stay out of its way rather
 * than stack two bars. While shown, a body class lifts the chat FAB and
 * compare tray above the bar (globals.css, mirroring pdp-atc-visible).
 */

const SUPPRESSED_PREFIXES = ['/admin', '/account', '/checkout', '/products/'];

export function StickyContactBar() {
  const pathname = usePathname();
  const suppressed = SUPPRESSED_PREFIXES.some((p) => pathname?.startsWith(p));

  // Signal the bar's presence so the floating widgets lift above it. The
  // lift CSS is scoped to <=768px, so this class is a harmless no-op on
  // desktop (where the bar itself is display:none).
  useEffect(() => {
    if (suppressed) return;
    document.body.classList.add('contactbar-visible');
    return () => document.body.classList.remove('contactbar-visible');
  }, [suppressed]);

  if (suppressed) return null;

  return (
    <div className="sticky-contact-bar" role="region" aria-label="Contact LA Mattress">
      <a
        className="btn btn-primary sticky-contact-btn"
        href={`tel:${SITE_PHONE_TEL}`}
        aria-label={`Call ${SITE_PHONE_DISPLAY}`}
      >
        <Icon name="phone" size={18} aria-hidden /> Call
      </a>
      <Link
        className="btn btn-ghost sticky-contact-btn"
        href="/pages/mattress-store-locations"
        onClick={() => track('directions_click', { page: pathname ?? '/', area: 'main' })}
      >
        <Icon name="pin" size={18} aria-hidden /> Find a store
      </Link>
    </div>
  );
}
