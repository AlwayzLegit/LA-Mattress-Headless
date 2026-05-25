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

function getHowTo(lds) {
  return lds.find((x) => x.key === 'ld-article-howto')?.data;
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
  // PR #254 renamed the editorial-team fallback "LA Mattress Store" →
  // "LA Mattress Editorial" — see lib/article-author.ts (EDITORIAL_
  // AUTHOR_NAME). The @id back-link still points at the sitewide
  // Organization so Google's entity graph reads the article and the
  // brand as one connected entity.
  const ld = getArticle(getArticleJsonLd(makeArticle({ author: null })));
  assert.ok(ld.author, 'author must always be present (Google BlogPosting requirement)');
  assert.equal(ld.author['@type'], 'Organization');
  assert.equal(ld.author.name, 'LA Mattress Editorial');
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

test('BlogPosting does NOT emit a `breadcrumb` property (invalid per schema.org)', () => {
  // Schema.org's `breadcrumb` property is defined on `WebPage`, NOT on
  // `Article` / `CreativeWork` / `BlogPosting`. SEMrush flagged this as
  // the SOLE schema-validation error on all 666 affected article pages
  // in the 2026-05-25 drill-down: "The property breadcrumb is not
  // recognized by Schema.org vocabulary." The BreadcrumbList is still
  // emitted as a sibling JSON-LD block — Google's entity graph
  // connects the two for the same page via the URL / @id, no inline
  // back-reference required.
  const lds = getArticleJsonLd(makeArticle());
  const article = getArticle(lds);
  assert.equal(article.breadcrumb, undefined,
    'BlogPosting must not declare `breadcrumb` — it is a WebPage-only property');
  // The BreadcrumbList sibling block still emits and still has its
  // canonical #breadcrumb @id (no change to that block — only the
  // back-reference on the BlogPosting was removed).
  const bc = getBreadcrumb(lds);
  assert.ok(bc, 'BreadcrumbList sibling block must still emit');
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

test('FAQ regex does NOT swallow intermediate non-question h3s into the captured question', () => {
  // Real article shape from /blogs/extra-info/what-is-polyurethane-foam
  // (SEMrush 2026-05-25 audit, 666 article pages flagged): the article
  // has a "Good fit if you:" section h3 (no `?`), then a "How to Care
  // for ..." section h3 (no `?`), and finally a real FAQ section with
  // 3 `<h3>question?</h3><p>answer</p>` pairs.
  //
  // The OLD regex used `[\s\S]*?` inside the h3-inner capture, which
  // backtracks across multiple `</h3>` boundaries to find one that is
  // immediately followed by `<p>`. Because the intermediate non-
  // question h3s are followed by `<ul>` / `<h2>` instead, the engine
  // skipped past them and collapsed the first real question + all the
  // preceding sections into one massive "question" name (1500+ chars
  // ending in `?` because the LAST swallowed h3 was the actual real
  // question). That malformed FAQPage was the schema error SEMrush
  // flagged. Fix is a tempered token `(?:(?!<h3\b)[\s\S])*?` that
  // forbids another `<h3` opening inside the capture.
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h3>Good fit if you:</h3>
      <ul><li>Want an affordable mattress.</li><li>Move around a lot.</li></ul>
      <h3>How to Care for a Polyurethane Foam Mattress</h3>
      <p>Rotate every 3–6 months.</p>
      <h3>Is polyurethane foam safe to sleep on?</h3><p>Yes, particularly if CertiPUR-US certified.</p>
      <h3>Is memory foam the same as polyurethane foam?</h3><p>Memory foam is a type of polyurethane foam.</p>
      <h3>Does polyurethane foam off-gas?</h3><p>New mattresses release VOCs for the first few days.</p>
    `,
  }));
  const faq = getFaq(lds);
  assert.ok(faq, 'FAQPage should still emit for the 3 well-formed Q&A pairs');
  // Each question name should be SHORT (just the question text), not a
  // multi-section blob. Lock it to <200 chars to catch the regression.
  for (const entity of faq.mainEntity) {
    assert.ok(entity.name.length < 200,
      `Question name too long (${entity.name.length} chars) — regex likely swallowed intermediate h3s: ${entity.name.slice(0, 100)}`);
  }
  // And the FIRST captured question must be the REAL first FAQ ("Is
  // polyurethane foam safe to sleep on?"), not a blob starting with
  // "Good fit if you:".
  assert.equal(faq.mainEntity[0].name, 'Is polyurethane foam safe to sleep on?');
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'Yes, particularly if CertiPUR-US certified.');
});

test('HowTo regex does NOT swallow intermediate non-step headings into the step name', () => {
  // Same tempering rationale as the FAQ regex above, applied to the
  // h[23] heading-inner capture in extractHowToStepsFromHtml. If an
  // editorial pull-quote h3 or section h2 lives between Step 1 and
  // Step 2, the OLD regex backtracked past it and collapsed Step 2's
  // opening into Step 1's "name", producing a malformed HowToStep.
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>Step 1: Measure your room</h2><p>Use a tape measure end to end.</p>
      <h3>Pro tip</h3><p>Standard frames add 4–6 inches around the mattress.</p>
      <h2>Step 2: Pick a size</h2><p>Queen, king, or California king.</p>
      <h3>Couples vs single sleepers</h3><p>Couples need queen minimum.</p>
      <h2>Step 3: Order online or in-store</h2><p>Both delivery options work.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.ok(howTo, 'HowTo should emit at 3 Step headings even with intermediate non-step h3s');
  assert.equal(howTo.step.length, 3);
  // Each step name must be SHORT — no swallowing of later step
  // headings into the prior step's name.
  for (const s of howTo.step) {
    assert.ok(s.name.length < 100,
      `Step name too long (${s.name.length} chars) — regex likely swallowed an intermediate heading: ${s.name.slice(0, 80)}`);
  }
  assert.equal(howTo.step[0].name, 'Measure your room');
  assert.equal(howTo.step[1].name, 'Pick a size');
  assert.equal(howTo.step[2].name, 'Order online or in-store');
});

/* --- HowTo extraction (Google rich-result for step-by-step guides) --- */

test('emits HowTo schema when article body has 3+ "Step N:" h2 headings', () => {
  // Mirrors the real shape of /blogs/mattress-buying-guide/how-to-choose-a-mattress
  // which has 13 `<h2>Step N: ...</h2>` headings followed by body paragraphs.
  const lds = getArticleJsonLd(makeArticle({
    title: 'How to Choose a Mattress',
    contentHtml: `
      <p>Intro paragraph.</p>
      <h2>Step 1: Start with your sleep position</h2>
      <p>Your dominant sleep position is the single most important factor.</p>
      <h2>Step 2: Factor in your body weight</h2>
      <p>Body weight changes how any mattress feels.</p>
      <h2>Step 3: Choose a mattress type</h2>
      <p>There are four core types: memory foam, hybrid, latex, innerspring.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.ok(howTo, 'HowTo should emit at 3+ Step headings');
  assert.equal(howTo['@type'], 'HowTo');
  assert.equal(howTo.name, 'How to Choose a Mattress');
  assert.equal(howTo.step.length, 3);
  assert.equal(howTo.step[0]['@type'], 'HowToStep');
  assert.equal(howTo.step[0].position, 1);
  assert.equal(howTo.step[0].name, 'Start with your sleep position');
  assert.match(howTo.step[0].text, /sleep position/);
  // HowTo has @id + mainEntityOfPage linking back to the article URL
  // so Google's entity graph treats it as a sibling of the BlogPosting.
  assert.match(howTo['@id'], /#howto$/);
  assert.ok(howTo.mainEntityOfPage);
  // Per-step `url` was removed — the article DOM uses heading-slug ids,
  // not positional #step-N. A fragment that doesn't exist on the page
  // is worse than no fragment; Google accepts steps without URLs.
  assert.equal(howTo.step[0].url, undefined);
});

test('HowTo step names strip the "Step N:" prefix', () => {
  // Anchor-text purpose: SERP rich result shows the step NAME, not
  // "Step 1: ...". The prefix should be stripped at extraction.
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>Step 1: Find your sleep position</h2><p>Side, back, or stomach.</p>
      <h2>Step 2: Factor in weight</h2><p>Light vs heavy bodies.</p>
      <h2>Step 3: Pick a type</h2><p>Memory foam vs hybrid.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.equal(howTo.step[0].name, 'Find your sleep position');
  assert.equal(howTo.step[1].name, 'Factor in weight');
  assert.equal(howTo.step[2].name, 'Pick a type');
});

test('HowTo accepts h3 step headings too', () => {
  // Some guides use h3 for steps when h2 is reserved for sections.
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>The Process</h2>
      <h3>Step 1: Measure the room</h3><p>Use a tape measure.</p>
      <h3>Step 2: Pick a size</h3><p>Queen, king, or California king.</p>
      <h3>Step 3: Order online or in-store</h3><p>Both work fine.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.ok(howTo);
  assert.equal(howTo.step.length, 3);
});

test('does NOT emit HowTo when article uses topical h2s instead of "Step N:"', () => {
  // The how-to-choose-mattress-firmness article uses topical h2s
  // ("What Is Mattress Firmness?", "Firmness vs. Support", "The Firmness
  // Scale", etc.) rather than the "Step N:" convention — correctly
  // stays on plain BlogPosting without bad HowTo schema.
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>What Is Mattress Firmness?</h2><p>Description.</p>
      <h2>The Firmness Scale</h2><p>Description.</p>
      <h2>Firmness by Sleep Position</h2><p>Description.</p>
      <h2>How Body Weight Changes Everything</h2><p>Description.</p>
    `,
  }));
  assert.equal(getHowTo(lds), undefined);
});

test('does NOT emit HowTo when fewer than 3 Step headings (insufficient sequence)', () => {
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>Step 1: Just one step</h2><p>Body.</p>
      <h2>Step 2: And another</h2><p>Body.</p>
    `,
  }));
  assert.equal(getHowTo(lds), undefined);
});

test('HowTo schema includes name + description + image-as-ImageObject from article metadata', () => {
  const lds = getArticleJsonLd(makeArticle({
    title: 'How to Clean a Mattress',
    seo: { title: null, description: 'Step-by-step mattress cleaning.' },
    image: { url: 'https://cdn.example.com/cleaning.jpg' },
    contentHtml: `
      <h2>Step 1: Strip the bed</h2><p>Remove all bedding.</p>
      <h2>Step 2: Vacuum thoroughly</h2><p>Use the upholstery attachment.</p>
      <h2>Step 3: Spot-treat stains</h2><p>Mild detergent works best.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.equal(howTo.name, 'How to Clean a Mattress');
  assert.equal(howTo.description, 'Step-by-step mattress cleaning.');
  // Image as ImageObject (not bare URL) — matches publisher.logo pattern
  // applied to BlogPosting; Google's documented preferred form.
  assert.equal(howTo.image['@type'], 'ImageObject');
  assert.equal(howTo.image.url, 'https://cdn.example.com/cleaning.jpg');
});

/* --- HowTo extraction robustness (code-review follow-ups) ------------ */

test('HowTo extracts step heading even when the prefix is bolded (Shopify WYSIWYG)', () => {
  // Common Shopify WYSIWYG output wraps the "Step N:" portion in
  // <strong> — the original regex required the literal "Step N:" to
  // appear adjacent to the opening h2 with no inline tags, silently
  // dropping these. The tag-tolerant extractor must handle it.
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2><strong>Step 1:</strong> Start with your position</h2><p>Side.</p>
      <h2><strong>Step 2:</strong> Factor in weight</h2><p>Light.</p>
      <h2><strong>Step 3:</strong> Pick a type</h2><p>Foam.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.ok(howTo, 'HowTo should emit even with bolded Step prefix');
  assert.equal(howTo.step.length, 3);
  assert.equal(howTo.step[0].name, 'Start with your position');
});

test('HowTo extracts step heading even when name contains inline tags', () => {
  // `<em>` / `<span>` inside the step name should not stop extraction
  // (the original [^<]+? lazy match aborted on any `<`).
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>Step 1: Choose <em>your</em> mattress size</h2><p>Side.</p>
      <h2>Step 2: <span>Compare</span> brands</h2><p>Tempur.</p>
      <h2>Step 3: Visit a <strong>showroom</strong></h2><p>Try it.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.ok(howTo);
  assert.equal(howTo.step.length, 3);
  // Name has tags stripped + whitespace collapsed.
  assert.equal(howTo.step[0].name, 'Choose your mattress size');
  assert.equal(howTo.step[1].name, 'Compare brands');
  assert.equal(howTo.step[2].name, 'Visit a showroom');
});

test('HowTo separator class no longer matches "Step 1.5" as Step 1', () => {
  // The original `[:.—–-]` class accepted `.` as a separator, so
  // `Step 1.5 considerations` matched as Step 1 with name "5
  // considerations". The fix removes `.` from the separator class.
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>Step 1.5 considerations</h2><p>Body.</p>
      <h2>Step 1: Real step</h2><p>Body.</p>
      <h2>Step 2: Real step</h2><p>Body.</p>
      <h2>Step 3: Real step</h2><p>Body.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.ok(howTo);
  // The "Step 1.5 considerations" heading should NOT count as a step
  // — only the three "Step N:" headings do.
  assert.equal(howTo.step.length, 3);
  assert.equal(howTo.step[0].name, 'Real step');
});

test('HowTo name drops trailing " | LA Mattress" / " | LA Mattress Store" suffix', () => {
  // Some Shopify article titles carry a brand suffix; the visible H1
  // already strips it via stripBrandSuffix, and the HowTo SERP rich-
  // result name should follow suit.
  const lds = getArticleJsonLd(makeArticle({
    title: 'How to Choose a Mattress | LA Mattress Store',
    contentHtml: `
      <h2>Step 1: One</h2><p>Body.</p>
      <h2>Step 2: Two</h2><p>Body.</p>
      <h2>Step 3: Three</h2><p>Body.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.equal(howTo.name, 'How to Choose a Mattress');
});

test('HowTo step body terminates correctly across mixed heading levels', () => {
  // h2 step → followed by h4 subsection → followed by next h2 step.
  // The h4 content should be folded into the FIRST step's text (the
  // lookahead intentionally stops only at h2/h3, not h4+, so step
  // bodies can contain subsections).
  const lds = getArticleJsonLd(makeArticle({
    contentHtml: `
      <h2>Step 1: First step</h2><p>Intro.</p><h4>Detail</h4><p>More.</p>
      <h2>Step 2: Second step</h2><p>Body.</p>
      <h2>Step 3: Third step</h2><p>Body.</p>
    `,
  }));
  const howTo = getHowTo(lds);
  assert.equal(howTo.step.length, 3);
  assert.match(howTo.step[0].text, /Intro/);
  assert.match(howTo.step[0].text, /Detail/);
});
