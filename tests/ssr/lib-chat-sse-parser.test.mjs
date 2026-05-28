/**
 * Unit tests for the chat SSE chunk parser in lib/chat/sse-parser.ts.
 *
 * The parser is the wire-format boundary between /api/chat's
 * ReadableStream and the React chat component's state updates. Any
 * regression here either drops shopper messages on the floor or
 * misroutes them — both invisible without a regression test. Pure
 * function: no React, no DOM, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { parseChatStreamChunk } = await import('../../lib/chat/sse-parser.ts');

const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;

test('parses a single complete event in one chunk', () => {
  const { events, buffer } = parseChatStreamChunk('', sse({ type: 'delta', text: 'hi' }));
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { type: 'delta', text: 'hi' });
  assert.equal(buffer, '');
});

test('parses multiple events delivered in one chunk', () => {
  const chunk = sse({ type: 'delta', text: 'hello ' }) + sse({ type: 'delta', text: 'world' });
  const { events, buffer } = parseChatStreamChunk('', chunk);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { type: 'delta', text: 'hello ' });
  assert.deepEqual(events[1], { type: 'delta', text: 'world' });
  assert.equal(buffer, '');
});

test('buffers a partial event across chunks (mid-JSON split)', () => {
  const full = sse({ type: 'delta', text: 'streaming-is-fun' });
  // Split in the middle of the JSON body.
  const splitIndex = Math.floor(full.length / 2);
  const first = full.slice(0, splitIndex);
  const second = full.slice(splitIndex);

  const r1 = parseChatStreamChunk('', first);
  assert.equal(r1.events.length, 0, 'no event yet — boundary not seen');
  assert.equal(r1.buffer, first);

  const r2 = parseChatStreamChunk(r1.buffer, second);
  assert.equal(r2.events.length, 1);
  assert.deepEqual(r2.events[0], { type: 'delta', text: 'streaming-is-fun' });
  assert.equal(r2.buffer, '');
});

test('buffers a partial event across chunks (split exactly at \\n\\n boundary)', () => {
  const evt = sse({ type: 'delta', text: 'boundary' });
  // The event body is "data: ...\n\n". Cut so the first chunk ends
  // with one \n and the second starts with the trailing \n.
  const splitAt = evt.length - 1;
  const r1 = parseChatStreamChunk('', evt.slice(0, splitAt));
  assert.equal(r1.events.length, 0);
  const r2 = parseChatStreamChunk(r1.buffer, evt.slice(splitAt));
  assert.equal(r2.events.length, 1);
  assert.deepEqual(r2.events[0], { type: 'delta', text: 'boundary' });
});

test('emits one event and buffers a half-formed trailing event', () => {
  const complete = sse({ type: 'delta', text: 'first' });
  const partial = `data: ${JSON.stringify({ type: 'delta', text: 'second-half' }).slice(0, 10)}`;
  const { events, buffer } = parseChatStreamChunk('', complete + partial);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { type: 'delta', text: 'first' });
  // Trailing partial is kept verbatim for the next chunk.
  assert.equal(buffer, partial);
});

test('drops a malformed JSON event without crashing the stream', () => {
  const chunk =
    'data: {not-valid-json}\n\n' +
    sse({ type: 'delta', text: 'survived' });
  const { events, buffer } = parseChatStreamChunk('', chunk);
  // First event silently dropped, second event parsed.
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { type: 'delta', text: 'survived' });
  assert.equal(buffer, '');
});

test('ignores events with no data: line (e.g. SSE comments or pings)', () => {
  // Per the SSE spec a line starting with `:` is a comment used as a
  // keepalive. Our server doesn't emit them today, but the parser
  // must not crash if a proxy injects one.
  const chunk = ': keepalive\n\n' + sse({ type: 'delta', text: 'after-comment' });
  const { events } = parseChatStreamChunk('', chunk);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { type: 'delta', text: 'after-comment' });
});

test('skips an empty data: line', () => {
  const chunk = 'data:   \n\n' + sse({ type: 'delta', text: 'real' });
  const { events } = parseChatStreamChunk('', chunk);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { type: 'delta', text: 'real' });
});

test('parses a full streaming turn end to end', () => {
  // Simulates the wire sequence /api/chat emits for a single turn:
  // text deltas → tool_use → tool_result → more deltas → done.
  const wire =
    sse({ type: 'delta', text: 'Let me search ' }) +
    sse({ type: 'delta', text: 'for that. ' }) +
    sse({
      type: 'tool_use',
      tool: 'search_catalog',
      id: 'tu_abc',
      summary: 'Searching for "queen hybrid"',
    }) +
    sse({
      type: 'tool_result',
      id: 'tu_abc',
      payload: {
        kind: 'products',
        cards: [
          {
            handle: 'helix-midnight',
            url: '/products/helix-midnight',
            title: 'Helix Midnight',
            vendor: 'Helix',
            imageUrl: null,
            imageAlt: 'Helix Midnight',
            priceRange: { minPrice: 1099, maxPrice: 1599, currency: 'USD' },
            rating: 4.6,
            ratingCount: 128,
            firmness: 'Medium',
            material: 'Hybrid',
          },
        ],
      },
    }) +
    sse({ type: 'delta', text: 'The Helix Midnight is a strong pick.' }) +
    sse({ type: 'done', stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 80 } });

  const { events, buffer } = parseChatStreamChunk('', wire);
  assert.equal(events.length, 6);
  assert.equal(events[0].type, 'delta');
  assert.equal(events[1].type, 'delta');
  assert.equal(events[2].type, 'tool_use');
  assert.equal(events[3].type, 'tool_result');
  assert.equal(events[3].payload.kind, 'products');
  assert.equal(events[3].payload.cards[0].handle, 'helix-midnight');
  assert.equal(events[4].type, 'delta');
  assert.equal(events[5].type, 'done');
  assert.equal(buffer, '');
});

test('handles an error event', () => {
  const { events } = parseChatStreamChunk(
    '',
    sse({ type: 'error', message: 'rate limit exceeded', status: 429 }),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'error');
  assert.equal(events[0].status, 429);
});

test('byte-by-byte delivery still produces the same events', () => {
  // Worst-case adversarial chunk size: 1 char at a time. The parser
  // must accumulate across chunks without losing or duplicating
  // events.
  const wire =
    sse({ type: 'delta', text: 'a' }) + sse({ type: 'delta', text: 'b' }) + sse({ type: 'done', stop_reason: 'end_turn' });
  let buffer = '';
  const collected = [];
  for (const ch of wire) {
    const { events, buffer: next } = parseChatStreamChunk(buffer, ch);
    buffer = next;
    collected.push(...events);
  }
  assert.equal(collected.length, 3);
  assert.deepEqual(collected[0], { type: 'delta', text: 'a' });
  assert.deepEqual(collected[1], { type: 'delta', text: 'b' });
  assert.equal(collected[2].type, 'done');
  assert.equal(buffer, '');
});
