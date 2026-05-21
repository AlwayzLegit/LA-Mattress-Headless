/**
 * Unit tests for lib/article-jsonld.ts — the BlogPosting + BreadcrumbList
 * (+ optional FAQPage) JSON-LD emitter for /blogs/[blog]/[article].
 *
 * Locks down the SEMrush 20260521_1 batch-4 fixes that target the
 * ~666 article pages flagged for structured-data errors. Each universal
 * BlogPosting-field fix lives behind a test below:
 *
 *   1. publisher.logo is an ImageObject with explicit width + height —
 *      Google's Article validator rejects dimensionless logos and tripped
 *      on every article page before the fix.
 *   2. dateModified is always emitted (falls back to publishedAt — the
 *      Storefront API doesn't expose updatedAt).
 *   3. author is always emitted — falls back to an Organization-author
 *      stub for articles missing the metafield (BlogPosting REQUIRES
 *      author per Google's rich-results spec).
 *   4. image is always emitted — falls back to the sitewide logo when
 *      the article has no featured image. Validators reject the empty
 *      / undefined forms.
 *
 * The Article type comes from @/lib/shopify via `import type`, erased
 * by Node 22's experimental-strip-types. No `server-only` reach.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { getArticleJsonLd } = await import('../../lib/article-jsonld.ts');

/**
 * Minimal Article fixture builder. Pass overrides to vary the shape;
 * defaults match a typical Shopify Storefront response for a published
 * article in the mattress-buying-guide blog.
 */
function makeArticle(overrides = {}) {
  return {
    id: 'gid://shopify/Article/1',
    handle: 'best-mattress-los-angeles',
    title: 'Best Mattress in Los Angeles',
    excerpt: 'A guide to choosing a mattress in LA.',
    publishedAt: '2026-05-01T10:00:00Z',
    image: { url: 'https://cdn.example.com/article.jpg' },
    author: { name: 'Anna', bio: null },
    contentHtml: '<p>Article body content.</p>',
    tags: ['mattress', 'los-angeles'],
    blog: { handle: 'mattress-buying-guide', title: 'Mattress Buying Guide' },
    seo: { title: null, description: 'A guide to choosing a mattress in LA.' },
    ...overrides,
  };
}

function getArticle(lds) {
  return lds.find((x) => x.key === 'ld-article')?.data;
}

function getBreadcrumb(lds) {
  return lds.find((x) => x.key === 'ld-breadcrumb-article')?.data;
}

function getFaq(lds) {
  return lds.find((x) => x.key === 'ld-article-faq')?.data;
}

/* --- publisher.logo dimensions (the big SEMrush 20260521_1 fix) ------- */

test('publisher.logo is an ImageObject with explicit width + height', () => {
  // Google's Article validator rejects a logo missing dimensions. The
  // previous shape emitted just `{ '@type': 'ImageObject', url: '...' }`
  // which fired on all 666 article pages.
  const ld = getArticle(getArticleJsonLd(makeArticle()));
  assert.equal(ld.publisher['@type'], 'Organization');
  assert.ok(ld.publisher.logo, 'publisher.logo must be present');
  assert.equal(ld.publisher.logo['@type'], 'ImageObject');
  assert.equal(typeof ld.publisher.logo.url, 'string');
  assert.equal(typeof ld.publisher.logo.width, 'number');
  assert.equal(typeof ld.publisher.logo.height, 'number');
  assert.ok(ld.publisher.logo.width > 0);
  assert.ok(ld.publisher.logo.height > 0);
});

test('publisher.logo width fits Google\'s 600px recommendation', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle()));
  assert.ok(
    ld.publisher.logo.width <= 600,
    'Google recommends max 600px logo width on Article publisher',
  );
});

test('publisher has @id linking to site Organization', () => {
  // @id link ties article publisher to the sitewide Organization schema
  // — keeps Google's entity graph as one node, not two.
  const ld = getArticle(getArticleJsonLd(makeArticle()));
  assert.equal(ld.publisher['@id'], 'https://www.mattressstoreslosangeles.com/#organization');
});

/* --- dateModified (Google requirement) -------------------------------- */

test('emits dateModified alongside datePublished', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({ publishedAt: '2026-05-01T10:00:00Z' })));
  assert.equal(ld.datePublished, '2026-05-01T10:00:00Z');
  assert.equal(ld.dateModified, '2026-05-01T10:00:00Z');
  // For now they're identical — Storefront API doesn't expose updatedAt.
  // Documented in the source as a known lossiness; future Admin-API
  // pull could differentiate. Test just verifies dateModified is present.
});

/* --- author guard (Google REQUIRES) ----------------------------------- */

test('uses Person author when present', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({ author: { name: 'Editor Smith', bio: null } })));
  assert.equal(ld.author['@type'], 'Person');
  assert.equal(ld.author.name, 'Editor Smith');
});

test('falls back to Organization author when article.author is null', () => {
  // Google's BlogPosting validator REQUIRES author. The previous shape
  // emitted `author: undefined` for articles whose merchant hadn't filled
  // the author metafield — which JSON.stringify drops, leaving the field
  // missing entirely. Organization-author fallback (linked by @id to
  // the sitewide Organization) keeps the field present + lossless.
  const ld = getArticle(getArticleJsonLd(makeArticle({ author: null })));
  assert.ok(ld.author, 'author must always be present (Google BlogPosting requirement)');
  assert.equal(ld.author['@type'], 'Organization');
  assert.equal(ld.author.name, 'LA Mattress Store');
  assert.equal(ld.author['@id'], 'https://www.mattressstoreslosangeles.com/#organization');
});

/* --- image fallback when article has none ----------------------------- */

test('uses featured image when present', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({
    image: { url: 'https://cdn.example.com/featured.jpg' },
  })));
  assert.deepEqual(ld.image, ['https://cdn.example.com/featured.jpg']);
});

test('falls back to sitewide logo when article has no image', () => {
  // Google's BlogPosting validator wants an image present. When the
  // article doesn't have a featured image, fall back to the sitewide
  // logo so the page still passes the "has image" check.
  const ld = getArticle(getArticleJsonLd(makeArticle({ image: null })));
  assert.ok(Array.isArray(ld.image));
  assert.equal(ld.image.length, 1);
  assert.match(ld.image[0], /la-mattress-logo\.png$/);
});

test('falls back to sitewide logo when image.url is empty string', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({ image: { url: '' } })));
  assert.ok(Array.isArray(ld.image));
  assert.match(ld.image[0], /la-mattress-logo\.png$/);
});

/* --- Description / keywords ----------------------------------------- */

test('uses seo.description when present', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({
    seo: { title: null, description: 'Custom SEO description.' },
    excerpt: 'Excerpt fallback.',
  })));
  assert.equal(ld.description, 'Custom SEO description.');
});

test('falls back to excerpt when seo.description is missing', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({
    seo: { title: null, description: null },
    excerpt: 'Excerpt fallback.',
  })));
  assert.equal(ld.description, 'Excerpt fallback.');
});

test('falls back to title when no description / excerpt', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({
    seo: { title: null, description: null },
    excerpt: null,
    title: 'Title is the last resort.',
  })));
  assert.equal(ld.description, 'Title is the last resort.');
});

test('keywords emitted when tags array is non-empty', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({ tags: ['mattress', 'sleep'] })));
  assert.equal(ld.keywords, 'mattress, sleep');
});

test('keywords omitted when tags array is empty', () => {
  const ld = getArticle(getArticleJsonLd(makeArticle({ tags: [] })));
  assert.equal(ld.keywords, undefined);
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
  assert.ok(ld.image, 'image required');
  assert.equal(ld.inLanguage, 'en-US');
});

/* --- BreadcrumbList -------------------------------------------------- */

test('breadcrumb has 3 levels: Home > Blog > Article', () => {
  const lds = getArticleJsonLd(makeArticle());
  const bc = getBreadcrumb(lds);
  assert.equal(bc['@type'], 'BreadcrumbList');
  assert.equal(bc.itemListElement.length, 3);
  assert.equal(bc.itemListElement[0].name, 'Home');
  assert.equal(bc.itemListElement[1].name, 'Mattress Buying Guide');
  assert.equal(bc.itemListElement[2].name, 'Best Mattress in Los Angeles');
});

test('breadcrumb @id matches BlogPosting.breadcrumb reference', () => {
  const lds = getArticleJsonLd(makeArticle());
  const article = getArticle(lds);
  const bc = getBreadcrumb(lds);
  // The two are connected by @id — same URL fragment with #breadcrumb.
  assert.equal(article.breadcrumb['@id'], bc['@id']);
  assert.match(bc['@id'], /#breadcrumb$/);
});

/* --- FAQ extraction --------------------------------------------------- */

test('emits FAQPage when article body has 3+ <h3>?</h3><p> pairs', () => {
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>Intro</h2><p>Some intro.</p>
      <h3>What's the best mattress brand?</h3><p>Tempur-Pedic and Stearns &amp; Foster top the list.</p>
      <h3>How long should a mattress last?</h3><p>10–15 years for a hybrid.</p>
      <h3>Is online cheaper?</h3><p>Same MAP pricing, just different delivery.</p>
    `,
  }));
  const faq = getFaq(lds);
  assert.ok(faq, 'FAQPage should emit at 3 Q&A pairs');
  assert.equal(faq['@type'], 'FAQPage');
  assert.equal(faq.mainEntity.length, 3);
  assert.equal(faq.mainEntity[0].name, "What's the best mattress brand?");
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'Tempur-Pedic and Stearns & Foster top the list.');
});

test('does NOT emit FAQPage when fewer than 3 Q&A pairs are present', () => {
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h3>What's the best brand?</h3><p>Tempur-Pedic.</p>
      <h3>How long?</h3><p>10 years.</p>
    `,
  }));
  assert.equal(getFaq(lds), undefined);
});

test('FAQ extraction ignores h3 sections that are not questions', () => {
  // The trailing-? check disambiguates question headings from brand /
  // section / topic headings (which also use <h3> in real articles).
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h3>Tempur-Pedic</h3><p>Premium memory foam.</p>
      <h3>Stearns &amp; Foster</h3><p>Hybrid construction.</p>
      <h3>Helix</h3><p>Online-native.</p>
    `,
  }));
  assert.equal(getFaq(lds), undefined);
});
