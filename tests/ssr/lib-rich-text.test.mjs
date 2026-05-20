/**
 * Unit tests for the Shopify rich-text-JSON → HTML serializer at
 * lib/shopify/rich-text.ts. These don't need the dev server, but they
 * live here so the existing tests/run.mjs glob picks them up.
 *
 * Node 22's built-in experimental-strip-types handles the .ts import
 * with no extra loader registration needed (CI pins node-version: 22).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { richTextJsonToHtml } = await import('../../lib/shopify/rich-text.ts');

test('returns empty string for null/undefined/empty input', () => {
  assert.equal(richTextJsonToHtml(null), '');
  assert.equal(richTextJsonToHtml(undefined), '');
  assert.equal(richTextJsonToHtml(''), '');
});

test('returns empty string for malformed JSON', () => {
  assert.equal(richTextJsonToHtml('not json'), '');
  assert.equal(richTextJsonToHtml('{incomplete'), '');
});

test('returns empty string when root type is wrong', () => {
  assert.equal(richTextJsonToHtml('{"type":"paragraph","children":[]}'), '');
});

test('serializes a simple paragraph with text', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: 'Hello world' }] },
    ],
  });
  assert.equal(richTextJsonToHtml(input), '<p>Hello world</p>');
});

test('serializes headings at the requested level', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'heading', level: 2, children: [{ type: 'text', value: 'About' }] },
      { type: 'heading', level: 3, children: [{ type: 'text', value: 'Details' }] },
    ],
  });
  assert.equal(richTextJsonToHtml(input), '<h2>About</h2><h3>Details</h3>');
});

test('clamps out-of-band heading levels to 1-6', () => {
  const tooLow = JSON.stringify({
    type: 'root',
    children: [{ type: 'heading', level: 0, children: [{ type: 'text', value: 'X' }] }],
  });
  const tooHigh = JSON.stringify({
    type: 'root',
    children: [{ type: 'heading', level: 9, children: [{ type: 'text', value: 'X' }] }],
  });
  const noLevel = JSON.stringify({
    type: 'root',
    children: [{ type: 'heading', children: [{ type: 'text', value: 'X' }] }],
  });
  assert.equal(richTextJsonToHtml(tooLow), '<h1>X</h1>');
  assert.equal(richTextJsonToHtml(tooHigh), '<h6>X</h6>');
  assert.equal(richTextJsonToHtml(noLevel), '<h2>X</h2>');
});

test('applies bold and italic formatting', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [
        { type: 'text', value: 'normal ' },
        { type: 'text', value: 'bold', bold: true },
        { type: 'text', value: ' ' },
        { type: 'text', value: 'italic', italic: true },
        { type: 'text', value: ' ' },
        { type: 'text', value: 'both', bold: true, italic: true },
      ]},
    ],
  });
  assert.equal(
    richTextJsonToHtml(input),
    '<p>normal <strong>bold</strong> <em>italic</em> <strong><em>both</em></strong></p>',
  );
});

test('serializes unordered and ordered lists', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'list', listType: 'unordered', children: [
        { type: 'list-item', children: [{ type: 'text', value: 'one' }] },
        { type: 'list-item', children: [{ type: 'text', value: 'two' }] },
      ]},
      { type: 'list', listType: 'ordered', children: [
        { type: 'list-item', children: [{ type: 'text', value: 'first' }] },
      ]},
    ],
  });
  assert.equal(
    richTextJsonToHtml(input),
    '<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>',
  );
});

test('serializes internal link with no target', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [
        { type: 'link', url: '/collections/queen', target: '_self', children: [{ type: 'text', value: 'Queen' }] },
      ]},
    ],
  });
  assert.equal(richTextJsonToHtml(input), '<p><a href="/collections/queen">Queen</a></p>');
});

test('adds rel="noopener noreferrer" on target=_blank links', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [
        { type: 'link', url: 'https://example.com', target: '_blank', children: [{ type: 'text', value: 'Ext' }] },
      ]},
    ],
  });
  assert.equal(
    richTextJsonToHtml(input),
    '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Ext</a></p>',
  );
});

test('renders title attribute on link when present', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [
        { type: 'link', url: '/x', title: 'X title', children: [{ type: 'text', value: 'X' }] },
      ]},
    ],
  });
  assert.equal(richTextJsonToHtml(input), '<p><a href="/x" title="X title">X</a></p>');
});

test('escapes HTML in text content (XSS defense)', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: '<script>alert(1)</script>' }] },
    ],
  });
  assert.equal(richTextJsonToHtml(input), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

test('escapes attributes in link URL and title', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [
        { type: 'link', url: '/x?a="b"&c=d', title: 'A "quoted" thing', children: [{ type: 'text', value: 'X' }] },
      ]},
    ],
  });
  assert.equal(
    richTextJsonToHtml(input),
    '<p><a href="/x?a=&quot;b&quot;&amp;c=d" title="A &quot;quoted&quot; thing">X</a></p>',
  );
});

test('preserves ampersand in plain text', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: 'Tom & Jerry' }] },
    ],
  });
  assert.equal(richTextJsonToHtml(input), '<p>Tom &amp; Jerry</p>');
});

test('drops unknown node types without throwing', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: 'before' }] },
      { type: 'mystery', children: [{ type: 'text', value: 'gone' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'after' }] },
    ],
  });
  assert.equal(richTextJsonToHtml(input), '<p>before</p><p>after</p>');
});

test('handles deeply nested content (heading inside body, list-item with link)', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'heading', level: 2, children: [{ type: 'text', value: 'What Is a Mattress?' }] },
      { type: 'paragraph', children: [
        { type: 'text', value: 'See ' },
        { type: 'link', url: '/collections/queen', children: [{ type: 'text', value: 'queen mattresses' }] },
        { type: 'text', value: '.' },
      ]},
      { type: 'list', listType: 'unordered', children: [
        { type: 'list-item', children: [
          { type: 'text', value: 'item with ' },
          { type: 'text', value: 'bold', bold: true },
        ]},
      ]},
    ],
  });
  assert.equal(
    richTextJsonToHtml(input),
    '<h2>What Is a Mattress?</h2>'
    + '<p>See <a href="/collections/queen">queen mattresses</a>.</p>'
    + '<ul><li>item with <strong>bold</strong></li></ul>',
  );
});

test('handles empty children arrays gracefully', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [
      { type: 'paragraph', children: [] },
      { type: 'heading', level: 2, children: [] },
      { type: 'list', listType: 'unordered', children: [] },
    ],
  });
  assert.equal(richTextJsonToHtml(input), '<p></p><h2></h2><ul></ul>');
});

test('handles missing children arrays (treats as empty)', () => {
  const input = JSON.stringify({
    type: 'root',
    children: [{ type: 'paragraph' }],
  });
  assert.equal(richTextJsonToHtml(input), '<p></p>');
});
