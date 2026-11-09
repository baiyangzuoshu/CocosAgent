import type { SearchResult, SessionEvent } from './types.ts';
import { deriveEventMessage, messageText, surfaceStatuses } from './surface.ts';

/** Search semantic message text over the full log, with an optional surface filter. */
export function searchEvents(
  events: readonly SessionEvent[],
  query: string,
  surface?: SearchResult['surface'],
): SearchResult[] {
  const normalizedQuery = normalizeWhitespace(query).toLocaleLowerCase();
  if (normalizedQuery.length === 0) throw new Error('query must contain non-whitespace text');
  const statuses = surfaceStatuses(events);

  return events.flatMap((event) => {
    const message = deriveEventMessage(event);
    if (message === null) return [];
    const text = messageText(message);
    const normalizedText = normalizeWhitespace(text).toLocaleLowerCase();
    const eventSurface = statuses.get(event.seq) ?? 'log-only';
    if (!normalizedText.includes(normalizedQuery) || (surface !== undefined && eventSurface !== surface)) return [];
    return [{ seq: event.seq, type: event.type, surface: eventSurface, text }];
  });
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}
