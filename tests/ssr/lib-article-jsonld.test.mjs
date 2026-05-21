/**
 * Unit tests for lib/article-jsonld.ts — the BlogPosting + BreadcrumbList
 * (+ optional FAQPage) JSON-LD emitter for /blogs/[blog]/[article].
 *
 * Locks down the SEMrush 20260521_1 batch-4 fixes that target the
 * ~1,000 "Structured data that contains markup errors" flags coming from
 * the blog corpus:
 *
 *   1. publisher.logo has explicit width + height (Google requires).
 *   2. dateModified is always emitted (falls back to publishedAt when
 *      Storefront doesn't expose updatedAt).
 *   3. author is always emitted — falls back to an Organization-author
 *      stub for articles missing the metafield (BlogPosting REQUIRES
 *      author per Google's rich-results spec).
 *   4. image is omitted entirely (not undefined) when there's no URL —
 *      schema validators reject `image: undefined` literally.
 *
 * Article fixtures are minimal — only the fields the JSON-LD generator
 * reads. Constructed inline rather than a shared fixture file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { getArticleJsonLd } = await import('../../lib/article-jsonld.ts');

function makeArticle(overrides = {}) {
  return {
    id: 'gid://shopify/Article/1',
    handle: 'test-article',
    title: 'A Test Article',
    contentHtml: '<p>Body text here.</p>',
    excerpt: 'A short excerpt.',
    publishedAt: '2024-01-15T10:00:00Z',
    image: { url: 'https://cdn.example.com/hero.jpg' },
    author: { name: 'Jane Doe', bio: null },
    tags: [],
    seo: { title: null, description: null },
    blog: { handle: 'mattress-buying-guide', title: 'Mattress Buying Guide' },
    ...overrides,
  };
}

function getArticle(lds) {
  const found = lds.find((x) => x.key === 'ld-article');
  return found ? found.data : null;
}

function getBreadcrumb(lds) {
  const found = lds.find((x) => x.key === 'ld-breadcrumb-article');
  return found ? found.data : null;
}

/* --- publisher.logo dimensions (the big one) -------------------------- */

test('publisher.logo has width + height (Google requires for ImageObject)', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle()));
  assert.ok(ld.publisher, 'publisher should be emitted');
  assert.ok(ld.publisher.logo, 'publisher.logo should be emitted');
  assert.equal(ld.publisher.logo['@type'], 'ImageObject');
  assert.equal(typeof ld.publisher.logo.width, 'number');
  assert.equal(typeof ld.publisher.logo.height, 'number');
  assert.ok(ld.publisher.logo.width > 0);
  assert.ok(ld.publisher.logo.height > 0);
});

test('publisher has @id linking to site Organization', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle()));
  // @id link ties article publisher to the sitewide Organization schema
  // — keeps Google's entity graph as one node, not two.
  assert.equal(ld.publisher['@id'], 'https://www.mattressstoreslosangeles.com/#organization');
});

/* --- dateModified ---------------------------------------------------- */

test('emits dateModified (Google BlogPosting recommends it)', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle()));
  assert.ok(ld.dateModified, 'dateModified should be present');
});

test('dateModified falls back to publishedAt when no updatedAt available', () => {
  // Storefront API doesn't expose article.updatedAt, so dateModified
  // tracks publishedAt — accepted by Google's validator.
  const ld = getArticle(getArticleJsonLd(makeArticle({ publishedAt: '2024-05-21T12:00:00Z' })));
  assert.equal(ld.dateModified, '2024-05-21T12:00:00Z');
  assert.equal(ld.datePublished, '2024-05-21T12:00:00Z');
});

/* --- author guard ---------------------------------------------------- */

test('falls back to Organization author when article.author is null', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({ author: null })));
  assert.ok(ld.author, 'author must always be present (Google BlogPosting requirement)');
  assert.equal(ld.author['@type'], 'Organization');
  assert.equal(ld.author.name, 'LA Mattress Store');
});

test('uses Person author when present', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({ author: { name: 'Editor Smith', bio: null } })));
  assert.equal(ld.author['@type'], 'Person');
  assert.equal(ld.author.name, 'Editor Smith');
});

/* --- image guard ----------------------------------------------------- */

test('omits image entirely when article has no cover image', () => {
  // `image: undefined` literally fails SDTT — must omit the key, not
  // set it to undefined.
  const ld = getArticle(getArticleJsonLd(makeArticle({ image: null })));
  assert.equal('image' in ld, false, 'image key must not appear when no URL');
});

test('omits image when image.url is empty string', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({ image: { url: '' } })));
  assert.equal('image' in ld, false);
});

test('emits image as array when present', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({
    image: { url: 'https://cdn.example.com/test.jpg' },
  })));
  assert.deepEqual(ld.image, ['https://cdn.example.com/test.jpg']);
});

/* --- BlogPosting core fields ----------------------------------------- */

test('BlogPosting LD has all Google-required fields', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle()));
  assert.equal(ld['@type'], 'BlogPosting');
  assert.ok(ld.headline, 'headline required');
  assert.ok(ld.datePublished, 'datePublished required');
  assert.ok(ld.dateModified, 'dateModified required');
  assert.ok(ld.author, 'author required');
  assert.ok(ld.publisher, 'publisher required');
  assert.ok(ld.publisher.logo.width && ld.publisher.logo.height, 'publisher.logo needs dimensions');
  assert.ok(ld.mainEntityOfPage, 'mainEntityOfPage required');
  assert.equal(ld.inLanguage, 'en-US');
});

/* --- BreadcrumbList -------------------------------------------------- */

test('Breadcrumb has 3 levels: Home → Blog → Article', () => {
  const ld = getBreadcrumb(getArticleJsonLd(makeArticle()));
  assert.equal(ld['@type'], 'BreadcrumbList');
  assert.equal(ld.itemListElement.length, 3);
  assert.equal(ld.itemListElement[0].name, 'Home');
  assert.equal(ld.itemListElement[1].name, 'Mattress Buying Guide');
  assert.equal(ld.itemListElement[2].name, 'A Test Article');
});

test('Breadcrumb @id matches BlogPosting.breadcrumb reference', () => {
  const lds = getArticleJsonLd(makeArticle());
  const article = getArticle(lds);
  const breadcrumb = getBreadcrumb(lds);
  // The two LD blobs reference each other via @id — Google ties them.
  assert.equal(article.breadcrumb['@id'], breadcrumb['@id']);
});

/* --- FAQPage (when 3+ Q&A pairs) ------------------------------------- */

test('FAQPage emitted when body has 3+ H3-Q / P-A pairs', () => {
  const article = makeArticle({
    contentHtml: `
      <p>Intro.</p>
      <h3>What is X?</h3><p>X is...</p>
      <h3>Why does Y happen?</h3><p>Because of Z.</p>
      <h3>How does it work?</h3><p>It works by...</p>
    `,
  });
  const lds = getArticleJsonLd(article);
  const faq = lds.find((x) => x.key === 'ld-article-faq');
  assert.ok(faq, 'FAQPage should be emitted with 3+ Q&A pairs');
  assert.equal(faq.data['@type'], 'FAQPage');
  assert.equal(faq.data.mainEntity.length, 3);
});

test('FAQPage NOT emitted when fewer than 3 pairs (Google rich-result rule)', () => {
  const article = makeArticle({
    contentHtml: '<h3>Only one?</h3><p>Just this.</p>',
  });
  const lds = getArticleJsonLd(article);
  const faq = lds.find((x) => x.key === 'ld-article-faq');
  assert.equal(faq, undefined);
});

test('FAQPage filter: H3 without `?` is ignored (section heading, not a question)', () => {
  // Topical <h3>s in the same articles look like questions but don't
  // end in `?` — the disambiguator.
  const article = makeArticle({
    contentHtml: `
      <h3>Tempur-Pedic</h3><p>Premium brand.</p>
      <h3>Stearns & Foster</h3><p>Luxury brand.</p>
      <h3>Diamond</h3><p>Value brand.</p>
    `,
  });
  const lds = getArticleJsonLd(article);
  const faq = lds.find((x) => x.key === 'ld-article-faq');
  assert.equal(faq, undefined, 'section headings should not become FAQ entries');
});
