import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';

export const metadata: Metadata = {
  // Next.js auto-injects <meta name="robots" content="noindex"/> on 404.
  title: 'Article not found',
};

export default function ArticleNotFound() {
  return (
    <main className="container" style={{ paddingTop: 'var(--s-10)', paddingBottom: 'var(--s-10)' }}>
      <div style={{ maxWidth: 720 }}>
        <div className="eyebrow">404, Article</div>
        <h1 className="h-display" style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>
          Lost in<br />the night.
        </h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.5, maxWidth: '50ch', marginBottom: 'var(--s-6)' }}>
          That article isn&rsquo;t here anymore. Browse the rest of our editorial below.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          <li><Link href="/blogs/sleep-blog" className="link-arrow">Sleep blog <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/blogs/mattress-buying-guide" className="link-arrow">Mattress buying guide <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/blogs/mattress-care-tips" className="link-arrow">Mattress care tips <Icon name="arrow-right" size={14} /></Link></li>
          <li><Link href="/collections/mattresses" className="link-arrow">Shop all mattresses <Icon name="arrow-right" size={14} /></Link></li>
        </ul>
      </div>
    </main>
  );
}
