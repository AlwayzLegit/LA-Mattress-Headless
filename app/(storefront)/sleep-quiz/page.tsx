import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { SleepQuiz } from './sleep-quiz';
import { allQuizPickHandles } from './quiz-data';
import { getQuizPicks } from '@/lib/shopify';
import { SITE_URL } from '@/lib/site-config';

export const metadata: Metadata = {
  // `absolute` so the layout's "%s · LA Mattress Store" template
  // can't append a second brand (QA: double-brand title).
  title: { absolute: 'Mattress Sleep Quiz · LA Mattress Store' },
  description: 'Answer 8 quick questions and get a mattress recommendation tailored to how you sleep. Free, takes under 2 minutes.',
  alternates: { canonical: '/sleep-quiz' },
  openGraph: {
    type: 'website',
    url: '/sleep-quiz',
    title: 'Sleep Quiz, LA Mattress Store',
    description: '8 questions, under 2 minutes, get a mattress matched to how you sleep.',
    // Quiz route has no associated image. Explicit reference to
    // app/opengraph-image.tsx so a share renders the brand card —
    // matches the Phase 180 fallback already on collection / article /
    // PDP routes.
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
};

export default function SleepQuizPage() {
  // Phase 255 follow-up: KICK OFF the picks fetch but DON'T await it
  // here — pass the unresolved Promise to the client SleepQuiz, which
  // awaits it lazily once the user reaches the result step. PostHog
  // web-vitals showed /sleep-quiz LCP p95 = 9.3s vs p75 = 1.96s — that
  // gulf is the Shopify multi-product fetch (~7 productByHandle queries
  // in one GraphQL call) blocking SSR on slow-merchant-API rolls of the
  // dice. The page shell (h1, lede, breadcrumbs, JSON-LD) doesn't
  // depend on the picks; awaiting them server-side just made the
  // shopper stare at a blank tab while the GraphQL roundtrip ran. With
  // the Promise handed to the client unresolved, the shell streams
  // immediately and the fetch overlaps with the 30–60s the user spends
  // answering 8 questions. By the time `step === 'result'`, the picks
  // are practically guaranteed to be resolved — and if not, SleepQuiz
  // shows a small loading state inline rather than blocking initial
  // paint. The fetch itself still happens server-side (kept warm by
  // ISR cache tags via the `quiz-picks` tag in getQuizPicks); only the
  // await moved.
  const productPicksPromise = getQuizPicks(allQuizPickHandles());
  const SITE = SITE_URL; // audit codeq-site-const-dup-10: single source, apex-guarded
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
              Tell us how you sleep, position, body, temperature, partner needs, and we&rsquo;ll
              shortlist the right mattresses for you. Free, under two minutes, no email required.
            </p>
            {/* Phase 260c: expanded descriptive copy beneath the quiz lede.
                SEMrush flagged /sleep-quiz for low word count, the quiz UI
                itself is mostly hidden inside form interactions, so the
                visible above-the-fold prose was thin. This paragraph also
                explains the methodology to shoppers who want to know how
                the recommendation is computed before answering. */}
            <p className="muted" style={{ maxWidth: '64ch', marginTop: 'var(--s-3)' }}>
              The quiz recommends one of four mattress materials, memory foam, hybrid, latex,
              or innerspring, based on the eight inputs that drive the decision in our showrooms.
              Sleep position decides how much contour you need at the shoulders and hips. Body
              weight changes how much pushback the support layer needs to give back. Temperature
              sensitivity decides whether memory foam will sleep too hot. Pain points (back,
              neck, joints) decide which support profile reduces pressure on the right spots.
              Partner motion decides how much isolation the foam layers need. And budget decides
              which tier we recommend, value, mid, or premium, across the brands we stock
              (Tempur-Pedic, Stearns &amp; Foster, Helix, Diamond, Southerland, Englander, Eastman
              House). You can try every recommendation in person at one of our 5 LA showrooms
              before buying, and every mattress ships with a 120-night Love Your Bed Guarantee.
            </p>
          </header>
          {/* Suspense boundary required for the useSearchParams() inside
              SleepQuiz, the homepage lead-in deep-links here with
              `?position=<id>` to pre-fill Q0. Without the boundary,
              Next 15 forces this page off static rendering. Fallback is
              a placeholder of roughly the same shape so the layout
              doesn't jump while the client takes over. */}
          <Suspense fallback={<div className="quiz quiz-loading" aria-hidden="true" />}>
            <SleepQuiz productPicksPromise={productPicksPromise} />
          </Suspense>
        </div>
      </section>

      <script id="ld-sleep-quiz" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(quizLd) }} />
      <script id="ld-breadcrumb-sleep-quiz" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
