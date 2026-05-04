import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
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
  const quizLd = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: 'LA Mattress Store sleep quiz',
    about: 'Mattress recommendation based on sleep position, body type, temperature, firmness, pain points, material preference, partner needs, and budget.',
    educationalUse: 'Recommendation',
    timeRequired: 'PT2M',
    provider: { '@type': 'Organization', name: 'LA Mattress Store', url: 'https://mattressstoreslosangeles.com' },
  };

  return (
    <main className="container">
      <section className="section quiz-section">
        <div className="quiz-shell">
          <nav className="lp-breadcrumbs">
            <Link href="/">Home</Link>
            <span className="sep">/</span>
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

      <Script id="ld-sleep-quiz" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(quizLd) }} />
    </main>
  );
}
