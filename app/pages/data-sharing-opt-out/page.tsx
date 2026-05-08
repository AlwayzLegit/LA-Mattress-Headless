import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';
import { SITE_PHONE_TEL, SITE_PHONE_DISPLAY } from '@/lib/site-config';
import { OptOutForm } from './opt-out-form';

const CONTACT_EMAIL = 'privacy@mattressstoreslosangeles.com';
const SITE = 'https://mattressstoreslosangeles.com';

export const metadata: Metadata = {
  title: 'Do Not Sell or Share My Personal Information',
  description:
    'California residents: submit a request to opt out of the sale or sharing of your personal information, or to exercise other rights under the CCPA / CPRA.',
  alternates: { canonical: `${SITE}/pages/data-sharing-opt-out` },
};

export default function DataSharingOptOutPage() {
  return (
    <main className="container" style={{ paddingTop: 'var(--s-7)', paddingBottom: 'var(--s-9)' }}>
      <nav className="lp-breadcrumbs" style={{ marginBottom: 'var(--s-5)' }}>
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <span>Privacy choices</span>
      </nav>

      <header style={{ maxWidth: 720, marginBottom: 'var(--s-7)' }}>
        <div className="eyebrow">Your privacy rights</div>
        <h1 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>
          Do not sell or share my personal information
        </h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.55, maxWidth: '60ch' }}>
          California residents have the right to opt out of the sale or sharing of their
          personal information, request access to or deletion of their data, and ask us to
          correct inaccurate information. Use the form below — we&rsquo;ll respond within
          45 days, as required by California law.
        </p>
      </header>

      <section className="ccpa-grid">
        <div className="ccpa-form-wrap">
          <OptOutForm />
        </div>

        <aside className="ccpa-aside">
          <h2 className="h3" style={{ marginTop: 0 }}>Other ways to submit a request</h2>
          <ul className="ccpa-aside-list">
            <li>
              <Icon name="phone" size={16} />{' '}
              <a href={`tel:${SITE_PHONE_TEL}`}>{SITE_PHONE_DISPLAY}</a> — call during showroom hours.
            </li>
            <li>
              <Icon name="card" size={16} />{' '}
              <a href={`mailto:${CONTACT_EMAIL}?subject=CCPA%20Request`}>{CONTACT_EMAIL}</a>
            </li>
          </ul>

          <h2 className="h3">What we&rsquo;ll do</h2>
          <ol className="ccpa-aside-steps">
            <li>Acknowledge your request within 10 business days.</li>
            <li>Verify your identity using the email or phone number on file.</li>
            <li>Process your request within 45 days. Complex cases may extend to 90 days; we&rsquo;ll let you know if so.</li>
            <li>Confirm the action we took (or explain in writing if we couldn&rsquo;t honor the request).</li>
          </ol>

          <h2 className="h3">Need more detail?</h2>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
            Read the full{' '}
            <Link href="/pages/privacy-policy" className="link-arrow">
              Privacy Policy <Icon name="arrow-right" size={12} />
            </Link>
            {' '}for the categories of information we collect, who we share it with, how long we
            retain it, and the legal basis for each use.
          </p>
        </aside>
      </section>
    </main>
  );
}
