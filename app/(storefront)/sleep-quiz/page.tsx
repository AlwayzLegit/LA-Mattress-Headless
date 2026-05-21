import type { Metadata } from 'next';
import Link from 'next/link';
import { SleepQuiz } from './sleep-quiz';
import { allQuizPickHandles } from './quiz-data';
import { getQuizPicks } from '@/lib/shopify';

export const metadata: Metadata = {
  // `absolute` so the layout's "%s · LA Mattress Store" template
  // can't append a second brand (QA: double-brand title).
  title: { absolute: 'Mattress Sleep Quiz · LA Mattress Store' },
  description: 'Answer 8 quick questions and get a mattress recommendation tailored to how you sleep. Free, takes under 2 minutes.',
  alternates: { canonical: '/sleep-quiz' },
  openGraph: {
    type: 'website',
    url: '/sleep-quiz',
    title: 'Sleep Quiz — LA Mattress Store',
    description: '8 questions, under 2 minutes — get a mattress matched to how you sleep.',
    // Quiz route has no associated image. Explicit reference to
    // app/opengraph-image.tsx so a share renders the brand card —
    // matches the Phase 180 fallback already on collection / article /
    // PDP routes.
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
};

export default async function SleepQuizPage() {
  // Phase 255: pre-fetch all candidate product picks server-side so the
  // result hero card paints immediately when the user finishes the quiz
  // instead of stalling on a client-side fetch. ISR caches the bundle.
  const productPicks = await getQuizPicks(allQuizPickHandles());
  const SITE = 'https://www.mattressstoreslosangeles.com';
  const url = `${SITE}/sleep-quiz`;
  const quizLd = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: 'LA Mattress Store sleep quiz',
    about: 'Mattress recommendation based on sleep position, body type, temperature, firmness, pain points, material preference, partner needs, and budget.',
    educationalUse: 'Recommendation',
    timeRequired: 'PT2M',
    inLanguage: 'en-US',
    provider: { '@type': 'Organization', name: 'LA Mattress Store', url: SITE },
  };
  // BreadcrumbList for the sleep-quiz route — every public top-level
  // page should advertise its breadcrumb structure to crawlers, not
  // just the cms / blog / collection / product templates.
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Sleep Quiz', item: url },
    ],
  };

  return (
    <main className="container">
      <section className="section quiz-section">
        <div className="quiz-shell">
          <nav className="lp-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep" aria-hidden="true">/</span>
            <span>Sleep Quiz</span>
          </nav>
          <header className="quiz-header">
            <div className="eyebrow">Sleep Quiz</div>
            <h1 className="h1">Find your mattress in 8 questions.</h1>
            <p className="lp-hero-lede">
              Tell us how you sleep — position, body, temperature, partner needs — and we&rsquo;ll
              shortlist the right mattresses for you. Free, under two minutes, no email required.
            </p>
            {/* Phase 260c: expanded descriptive copy beneath the quiz lede.
                SEMrush flagged /sleep-quiz for low word count — the quiz UI
                itself is mostly hidden inside form interactions, so the
                visible above-the-fold prose was thin. This paragraph also
                explains the methodology to shoppers who want to know how
                the recommendation is computed before answering. */}
            <p className="muted" style={{ maxWidth: '64ch', marginTop: 'var(--s-3)' }}>
              The quiz recommends one of four mattress materials — memory foam, hybrid, latex,
              or innerspring — based on the eight inputs that drive the decision in our showrooms.
              Sleep position decides how much contour you need at the shoulders and hips. Body
              weight changes how much pushback the support layer needs to give back. Temperature
              sensitivity decides whether memory foam will sleep too hot. Pain points (back,
              neck, joints) decide which support profile reduces pressure on the right spots.
              Partner motion decides how much isolation the foam layers need. And budget decides
              which tier we recommend — value, mid, or premium — across the brands we stock
              (Tempur-Pedic, Stearns &amp; Foster, Helix, Diamond, Southerland, Englander, Eastman
              House). You can try every recommendation in person at one of our 5 LA showrooms
              before buying, and every mattress ships with a 120-night Love Your Bed Guarantee.
            </p>
          </header>
          <SleepQuiz productPicks={productPicks} />
        </div>
      </section>

      <script id="ld-sleep-quiz" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(quizLd) }} />
      <script id="ld-breadcrumb-sleep-quiz" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
