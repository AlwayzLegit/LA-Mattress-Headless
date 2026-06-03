import Link from 'next/link';
import { MATTRESS_SIZES, type MattressSize } from '@/lib/mattress-sizes-data';
import { getArticleEnrichment } from '@/lib/article-enrichment';

/**
 * Code-controlled enrichment rendered after the merchant body on the
 * highest-priority size-guide articles (see lib/article-enrichment.ts for
 * the why). Adds a precise dimensions reference, a size comparison,
 * related-size internal links, and an FAQ — addressing the 20260603 ideas
 * flags (thin content, missing related words, weak internal linking,
 * bounce) without editing the merchant article body. Returns null for
 * unmatched handles, so it's a no-op on every other article.
 */

function byName(name: string): MattressSize | undefined {
  return MATTRESS_SIZES.find((s) => s.name === name);
}

function SpecRow({ s }: { s: MattressSize }) {
  return (
    <tr>
      <th scope="row" className="ms-dims-name">
        <Link href={s.collectionHref}>{s.name}</Link>
      </th>
      <td className="tnum">{s.inches}</td>
      <td className="tnum">{s.feet}</td>
      <td className="tnum">{s.cm}</td>
      <td>{s.sleepers === 2 ? 'Two' : 'One'}</td>
      <td className="tnum">{s.minRoom}</td>
    </tr>
  );
}

export function ArticleEnrichment({ handle }: { handle: string }) {
  const cfg = getArticleEnrichment(handle);
  if (!cfg) return null;

  const headingId = `art-enrich-${handle}`;
  const faqId = `art-enrich-faq-${handle}`;

  let rows: MattressSize[] = [];
  let featured: MattressSize | undefined;
  if (cfg.kind === 'size') {
    featured = byName(cfg.sizeName);
    rows = [cfg.sizeName, ...cfg.neighbors].map(byName).filter((s): s is MattressSize => Boolean(s));
  } else {
    rows = cfg.sizes.map(byName).filter((s): s is MattressSize => Boolean(s));
    featured = rows[0];
  }
  if (!rows.length) return null;

  return (
    <section className="container art-enrich" aria-labelledby={headingId}>
      <h2 id={headingId} className="h2 ms-section-h">{cfg.heading}</h2>
      <p className="muted ms-section-lede">{cfg.lede}</p>

      <div className="ms-dims-tablewrap">
        <table className="ms-dims-table">
          <caption className="sr-only">{cfg.heading}: dimensions in inches, feet and centimeters with capacity and minimum room size</caption>
          <thead>
            <tr>
              <th scope="col">Size</th>
              <th scope="col">Inches (W × L)</th>
              <th scope="col">Feet</th>
              <th scope="col">Centimeters</th>
              <th scope="col">Sleeps</th>
              <th scope="col">Min. room</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <SpecRow key={s.name} s={s} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="art-enrich-links">
        {featured ? (
          <>
            <Link href={featured.collectionHref} className="link-arrow">Shop {featured.name} mattresses</Link>
            {' · '}
          </>
        ) : null}
        <Link href="/pages/mattress-sizes" className="link-arrow">Full mattress size chart</Link>
        {' · '}
        <Link href="/sleep-quiz" className="link-arrow">Take the 2-minute sleep quiz</Link>
      </p>

      <h3 id={faqId} className="art-enrich-faq-h">Frequently asked questions</h3>
      <div className="ms-faq-list">
        {cfg.faq.map((item) => (
          <details key={item.q} className="ms-faq-item">
            <summary className="ms-faq-q">{item.q}</summary>
            <div className="ms-faq-a"><p>{item.a}</p></div>
          </details>
        ))}
      </div>
    </section>
  );
}
