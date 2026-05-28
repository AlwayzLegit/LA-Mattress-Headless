import type { ChatStreamEvent } from './types';

/**
 * Pure-function SSE chunk parser for the chat client. Lifted out of
 * chat-conversation.tsx so we can unit-test the wire format separately
 * from React state updates.
 *
 * Server-Sent Events delimit events with a blank line ("\n\n"); each
 * event has one or more "<field>: <value>" lines. We only emit `data:`
 * lines on the server, so this parser ignores anything else.
 *
 * Buffer handling: chunks may split mid-event (mid-JSON, even
 * mid-multi-byte char — the caller's TextDecoder handles UTF-8). Pass
 * the prior `buffer` back in on the next call. Caller stops when the
 * reader EOFs.
 *
 * Malformed events (bad JSON, missing data line, empty payload) are
 * silently dropped — same forgiveness the previous inline parser had.
 * Telemetry of dropped events would be useful future scope.
 */
export type ParseChunkResult = {
  events: ChatStreamEvent[];
  /** Bytes left over after the last complete event boundary. */
  buffer: string;
};

export function parseChatStreamChunk(buffer: string, chunk: string): ParseChunkResult {
  let working = buffer + chunk;
  const events: ChatStreamEvent[] = [];
  while (true) {
    const boundary = working.indexOf('\n\n');
    if (boundary === -1) break;
    const rawEvent = working.slice(0, boundary);
    working = working.slice(boundary + 2);
    const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'));
    if (!dataLine) continue;
    const json = dataLine.slice(5).trim();
    if (!json) continue;
    try {
      events.push(JSON.parse(json) as ChatStreamEvent);
    } catch {
      // Drop malformed events — server should never produce them, and
      // crashing the stream because of one bad packet would erase the
      // shopper's in-flight answer.
    }
  }
  return { events, buffer: working };
}
