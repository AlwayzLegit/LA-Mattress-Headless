import Image from 'next/image';
import Link from 'next/link';
import { SITE_PHONE_DISPLAY, SITE_EMAIL } from '@/lib/site-config';
import { NewsletterForm } from './newsletter-form';

type Col = { title: string; links: { label: string; href: string }[] };
const COLS: Col[] = [
  { title: 'Shop', links: [
    { label: 'Mattresses',      href: '/collections/mattresses' },
    { label: 'Adjustable Beds', href: '/collections/adjustable-beds' },
    { label: 'Brands',          href: '/pages/mattress-brands' },
    { label: 'Accessories',     href: '/collections/sheets-pillowcases' },
    { label: 'Pillows',         href: '/collections/pillows' },
    { label: 'Deals',           href: '/collections/on-sale' },
  ]},
  { title: 'Help', links: [
    { label: 'Financing', href: '/pages/mattress-store-financing' },
    { label: 'Delivery',  href: '/pages/mattress-store-delivery' },
    { label: 'Returns',   href: '/pages/returns' },
    { label: 'Warranty',  href: '/pages/warranty' },
    { label: 'FAQ',       href: '/pages/mattress-faq' },
    { label: 'Contact',   href: '/pages/mattress-store-contact' },
  ]},
  { title: 'Stores', links: [
    { label: 'Koreatown',     href: '/pages/koreatown-best-mattress-store' },
    { label: 'West LA',       href: '/pages/best-mattress-store-west-la' },
    { label: 'Hancock Park',  href: '/pages/best-mattress-store-la-brea' },
    { label: 'Studio City',   href: '/pages/mattress-store-studio-city' },
    { label: 'Glendale',      href: '/pages/mattress-store-in-glendale' },
    { label: 'Find a store',  href: '/pages/mattress-store-locations' },
  ]},
  { title: 'Company', links: [
    { label: 'About',         href: '/pages/about' },
    { label: 'Careers',       href: '/pages/choose-a-career-with-la-mattress' },
    { label: 'Reviews',       href: '/pages/reviews' },
    { label: 'Recycling fee', href: '/pages/mattress-recycling-fee' },
    { label: 'Accessibility', href: '/pages/data-sharing-opt-out' },
  ]},
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-top">
        <div className="footer-newsletter">
          <h3 className="h2 footer-h">Sleep on it.</h3>
          <p className="muted footer-lede">First dibs on floor-model markdowns, plus our quarterly mattress-care guide. No spam.</p>
          <NewsletterForm />
          <div className="footer-fineprint muted">By subscribing you agree to our Privacy Policy.</div>
        </div>
        <div className="footer-cols">
          {COLS.map((c) => (
            <div key={c.title}>
              <div className="eyebrow">{c.title}</div>
              <ul>
                {c.links.map((l) => (
                  <li key={l.label}><Link href={l.href}>{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
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
          />
          <div className="footer-sig-tagline">
            <div className="footer-sig-tag-line">Family-owned in Los Angeles since 2012</div>
            <div className="footer-sig-tag-line muted">5 showrooms · {SITE_PHONE_DISPLAY} · {SITE_EMAIL}</div>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <div className="footer-meta-line muted">© 2026 LA Mattress Store. All rights reserved.</div>
        <ul className="footer-legal-links">
          <li><Link href="/pages/privacy-policy">Privacy</Link></li>
          <li><Link href="/pages/terms-conditions">Terms</Link></li>
          <li><Link href="/pages/data-sharing-opt-out">Accessibility</Link></li>
          <li><Link href="/pages/data-sharing-opt-out">Do Not Sell My Info</Link></li>
          <li><Link href="/sitemap.xml">Sitemap</Link></li>
        </ul>
      </div>
    </footer>
  );
}
