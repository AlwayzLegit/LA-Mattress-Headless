import type { Metadata } from 'next';
import Link from 'next/link';
import { SleepQuiz } from './sleep-quiz';

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
  const SITE = 'https://mattressstoreslosangeles.com';
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
          </header>
          <SleepQuiz />
        </div>
      </section>

      <script id="ld-sleep-quiz" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(quizLd) }} />
      <script id="ld-breadcrumb-sleep-quiz" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </main>
  );
}
