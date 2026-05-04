import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';

export const metadata: Metadata = {
  title: 'Sleep Quiz — LA Mattress Store',
  description: 'Answer 8 quick questions and get a mattress recommendation tailored to how you sleep. Free, takes under 2 minutes.',
  alternates: { canonical: '/sleep-quiz' },
  openGraph: {
    type: 'website',
    url: '/sleep-quiz',
    title: 'Sleep Quiz — LA Mattress Store',
    description: '8 questions, under 2 minutes — get a mattress matched to how you sleep.',
  },
};

export default function SleepQuizPage() {
  return (
    <main className="container">
      <section className="section" style={{ paddingTop: 'var(--s-8)' }}>
        <div style={{ maxWidth: 720 }}>
          <nav className="lp-breadcrumbs">
            <Link href="/">Home</Link>
            <span className="sep">/</span>
            <span>Sleep Quiz</span>
          </nav>
          <div className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>Sleep Quiz</div>
          <h1 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>
            Find your match in 8 questions.
          </h1>
          <p className="lp-hero-lede" style={{ marginBottom: 'var(--s-5)' }}>
            Tell us how you sleep — position, body, temperature, partner needs — and we&rsquo;ll
            shortlist the right mattresses for you. The full interactive quiz launches soon.
          </p>

          <div
            style={{
              padding: 'var(--s-5)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-3)',
              background: 'var(--surface-2)',
              marginBottom: 'var(--s-6)',
            }}
          >
            <div className="eyebrow">Coming soon</div>
            <p style={{ margin: 'var(--s-3) 0 var(--s-4)' }}>
              Our 8-question matcher is being built. In the meantime, our team can walk you through
              the same questions in person at any LA showroom — or by phone.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
              <Link href="/pages/mattress-store-locations" className="btn btn-primary">
                Find a showroom <Icon name="arrow-right" size={14} />
              </Link>
              <a href="tel:+12135550142" className="btn btn-ghost">
                <Icon name="phone" size={14} /> Call (213) 555-0142
              </a>
            </div>
          </div>

          <div className="eyebrow">In the meantime — start here</div>
          <ul style={{ display: 'grid', gap: 'var(--s-3)', listStyle: 'none', padding: 0, margin: 'var(--s-3) 0 var(--s-7)' }}>
            <li>
              <Link href="/pages/mattress-types" className="link-arrow">
                Compare mattress types: foam, hybrid, innerspring, latex <Icon name="arrow-right" size={14} />
              </Link>
            </li>
            <li>
              <Link href="/pages/mattress-sizes" className="link-arrow">
                Pick the right size: twin through California king <Icon name="arrow-right" size={14} />
              </Link>
            </li>
            <li>
              <Link href="/collections/mattresses" className="link-arrow">
                Browse all mattresses <Icon name="arrow-right" size={14} />
              </Link>
            </li>
            <li>
              <Link href="/collections/on-sale" className="link-arrow">
                See current deals <Icon name="arrow-right" size={14} />
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
