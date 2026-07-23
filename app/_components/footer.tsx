import Image from 'next/image';
import Link from 'next/link';
import { resolveSiteConfig } from '@/lib/site-config';
import { getSiteConfig } from '@/lib/shopify';
import { NewsletterForm } from './newsletter-form';

type Col = { title: string; links: { label: string; href: string }[] };

// Footer columns — restructured 2026-05-26 to balance visual weight
// and match the industry-standard buyer-journey IA (Helix, Saatva,
// Casper, DreamCloud all follow a Shop / Customer Care / Visit Us /
// About 4-column split).
//
// Removed from Shop: Best Sellers, Luxury Mattresses (both reachable
// from the nav mega-menu), Accessories (mislabelled as sheets), and
// the three pillow rows (Pillows, Cooling Pillows, Rize Pillows) +
// Comforters + Mattress Protectors — all consolidated under the
// "Bedding & Pillows" entry that points at /collections/bedding.
// Added Sleep Quiz to Shop so footer mirrors the discovery surfaces
// we've been promoting elsewhere (nav slot, homepage lead-in, FAB).
//
// Help renamed to Customer Care (clearer scope), Returns relabeled
// to "120-Night Trial" (the brand's actual guarantee — better selling
// vocab than the generic "Returns"), Mattress Recycling moved here
// from Company (customer-facing fee, not a corp page).
//
// Stores renamed to Visit Us (more inviting), Mattress Guides moved
// from Help to About (it's editorial content, not customer support).
const COLS: Col[] = [
  { title: 'Shop', links: [
    { label: 'Mattresses',          href: '/collections/mattresses' },
    { label: 'Adjustable Beds',     href: '/collections/adjustable-beds' },
    { label: 'Bedding & Pillows',   href: '/collections/bedding' },
    { label: 'Bed Frames',          href: '/collections/bed-frames' },
    { label: 'Brands',              href: '/pages/mattress-brands' },
    { label: 'Sleep Quiz',          href: '/sleep-quiz' },
    { label: 'Deals',               href: '/collections/on-sale' },
  ]},
  { title: 'Customer Care', links: [
    { label: '0% APR Financing',    href: '/pages/mattress-store-financing' },
    { label: 'Delivery & Setup',    href: '/pages/mattress-store-delivery' },
    { label: '120-Night Trial',     href: '/pages/love-your-bed-guarantee' },
    { label: 'Warranty',            href: '/pages/warranty' },
    { label: 'Mattress Recycling',  href: '/pages/mattress-recycling-fee' },
    { label: 'FAQ',                 href: '/pages/faq' },
    { label: 'Contact',             href: '/pages/mattress-store-contact' },
  ]},
  { title: 'Visit Us', links: [
    { label: 'Koreatown',           href: '/pages/koreatown-best-mattress-store' },
    { label: 'West LA',             href: '/pages/best-mattress-store-west-la' },
    { label: 'La Brea',             href: '/pages/best-mattress-store-la-brea' },
    { label: 'Studio City',         href: '/pages/mattress-store-studio-city' },
    { label: 'Glendale',            href: '/pages/mattress-store-in-glendale' },
    { label: 'All locations',       href: '/pages/mattress-store-locations' },
    // "Near me" intent surface — duplicates the all-locations target but
    // with the exact keyword phrase visitors search ("mattress store
    // near you / near me"), so the footer carries a crawlable on-page
    // signal for the 33k-vol query competitors rank for.
    { label: 'Find a store near you', href: '/pages/mattress-store-locations' },
  ]},
  { title: 'About', links: [
    { label: 'About LA Mattress',   href: '/pages/about' },
    { label: 'Mattress Guides',     href: '/blogs' },
    { label: 'Customer Reviews',    href: '/pages/reviews' },
    { label: 'Careers',             href: '/pages/choose-a-career-with-la-mattress' },
    // "Accessibility" link removed from this column because the only
    // available destination (/pages/data-sharing-opt-out) is the CCPA
    // opt-out, not an accessibility statement. The legal-links row at
    // the bottom still carries the CCPA destination under its honest
    // label ("Do Not Sell or Share My Personal Information" — the
    // exact CPRA-required wording, Round 13). When the merchant publishes a
    // real /pages/accessibility statement, add it back here.
  ]},
];

export async function Footer() {
  // Live phone / email / social — merchant edits the `site_config`
  // metaobject in Shopify Admin and the footer reflects within an
  // ISR cycle. `getSiteConfig()` is React.cache()-memoized so the
  // storefront layout's call (for Organization JSON-LD) and this
  // call share one Storefront request per render. Falls back to the
  // static constants when Shopify is unreachable.
  const config = resolveSiteConfig(await getSiteConfig());
  return (
    <footer className="footer">
      <div className="container footer-top">
        <div className="footer-newsletter">
          {/* Marketing headline, visually heading-styled, but it labels
              the newsletter form below so we promote it to a real <h2>
              with aria-labelledby so the form region is named. */}
          <h2 id="footer-newsletter-h" className="h2 footer-h">Sleep on it.</h2>
          <p className="muted footer-lede">First dibs on floor-model markdowns, plus our quarterly mattress-care guide. No spam.</p>
          <NewsletterForm />
          <div className="footer-fineprint muted">
            By subscribing you agree to our{' '}
            <Link href="/pages/privacy-policy" className="footer-fineprint-link">Privacy Policy</Link>.
          </div>
        </div>
        <div className="footer-cols">
          {COLS.map((c) => {
            // Slugify: raw titles like 'Customer Care' produced an id with a
            // space, which tokenizes the aria-labelledby IDREF into two dead
            // references (audit a11y-aria-02).
            const navId = `footer-col-${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            return (
              // Each column is a nav landmark for SR landmark-nav. The
              // .eyebrow class is stylistic; the element is now a real
              // <h3> so heading-jump (NVDA H / JAWS) can skim Shop / Help
              // / Stores / Company. aria-labelledby ties the heading to
              // the list so the column has a programmatic name.
              <nav key={c.title} aria-labelledby={navId}>
                <h3 id={navId} className="eyebrow">{c.title}</h3>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.label}><Link href={l.href}>{l.label}</Link></li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>
      </div>
      <div className="container footer-signature">
        <div className="footer-sig-inner">
          <Image
            src="/assets/la-mattress-logo.png"
            alt="LA Mattress"
            className="footer-sig-logo"
            width={400}
            height={224}
            // CRO review 2026-07-22: the custom image loader returns
            // local /assets paths unchanged for every requested width,
            // so next/image was emitting a srcset of N identical URLs
            // with fake width descriptors. `unoptimized` drops the
            // srcset entirely and serves the single 400px source —
            // already ≥2x the ~129px display size, so no quality loss.
            unoptimized
          />
          <div className="footer-sig-tagline">
            <div className="footer-sig-tag-line">Family-owned in Los Angeles since 2012</div>
            <div className="footer-sig-tag-line muted">
              5 showrooms · <a href={`tel:${config.phoneTel}`} className="footer-sig-link">{config.phoneDisplay}</a> · <a href={`mailto:${config.email}`} className="footer-sig-link">{config.email}</a>
            </div>
          </div>
          {config.socialProfiles.length > 0 ? (
            // Inline SVGs (not Icon component) so social glyphs stay
            // self-contained to the footer — they're the only place
            // these icons appear, and adding them to Icon would mean
            // updating its discriminated-union type for one consumer.
            // rel="me noopener" advertises ownership to crawlers (some
            // engines use rel=me as an Organization sameAs signal) and
            // blocks tabnabbing on the external anchor.
            <ul className="footer-social" aria-label="Follow LA Mattress on social media">
              {config.socialProfiles.map((url) => {
                const label = /facebook\.com/.test(url) ? 'Facebook'
                  : /instagram\.com/.test(url) ? 'Instagram'
                  : /yelp\.com/.test(url) ? 'Yelp'
                  : /youtube\.com/.test(url) ? 'YouTube'
                  : /tiktok\.com/.test(url) ? 'TikTok'
                  : 'Social profile';
                return (
                  <li key={url}>
                    <a href={url} rel="me noopener" target="_blank" aria-label={`LA Mattress on ${label}`}>
                      {label === 'Facebook' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.2 22v-8H6v-4h3.2V7.5C9.2 4.6 11 3 13.6 3c1.3 0 2.4.1 2.7.1v3.2h-1.8c-1.4 0-1.7.7-1.7 1.7V10h3.4l-.4 4h-3v8H9.2z"/></svg>
                      ) : label === 'Instagram' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                      ) : label === 'Yelp' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 2c.6 0 1 .4 1 1l-.5 7.3c0 .9-1.1 1.3-1.7.6L9.2 6.4c-.5-.6-.2-1.4.5-1.6L13.7 2c.1 0 .2 0 .3 0zm6.5 6.7c.2.5-.1 1.1-.7 1.3L15.6 12c-.8.2-1.5-.6-1.1-1.4l2.3-4.4c.3-.6 1-.7 1.5-.4l1.7 1.5c.2.2.4.4.5.7v.7zm-.5 7c.5.3.5 1 .1 1.4l-1.5 1.7c-.4.5-1.1.5-1.5 0L14 14.5c-.5-.6 0-1.5.8-1.5l4.6.1c.2 0 .3 0 .4.1l.2.5zm-8 6.3c-.4.1-.9-.1-1-.5L9.3 17c-.3-.7.3-1.4 1-1.3l4.9.8c.6.1.9.7.6 1.2L13.4 21.5c-.2.3-.5.5-.9.5h-.5zM6 9c.2-.6.9-.9 1.5-.6l4.1 2.2c.7.4.6 1.5-.2 1.7L6.3 13.6c-.6.2-1.3-.2-1.3-.9V9.6c0-.2 0-.4.1-.6l.9-.0z"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="container footer-bottom">
        <div className="footer-meta-line muted">© 2026 LA Mattress Store. All rights reserved.</div>
        {/* Legal-links row. The previous version had "Accessibility"
            and "Do Not Sell My Info" both pointing at the same CCPA
            opt-out destination, misleading. Removed the misnamed
            "Accessibility" entry; the honest CCPA label stays. Add a
            real /pages/accessibility link here when one ships. */}
        <ul className="footer-legal-links">
          <li><Link href="/pages/privacy-policy">Privacy</Link></li>
          <li><Link href="/pages/terms-conditions">Terms</Link></li>
          <li><Link href="/pages/data-sharing-opt-out">Do Not Sell or Share My Personal Information</Link></li>
          <li><Link href="/pages/sitemap">Sitemap</Link></li>
        </ul>
      </div>
    </footer>
  );
}
