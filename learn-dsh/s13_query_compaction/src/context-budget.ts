import type { Measurement, PricedNode, SessionEvent } from './types.ts';
import { deriveEventMessage, foldSurface, messageText } from './surface.ts';

/** Count characters as deterministic teaching units; this is not a tokenizer. */
export function measureSurface(events: readonly SessionEvent[]): Measurement {
  const folded = foldSurface(events);
  const bySeq = new Map(events.map((event) => [event.seq, event]));
  const nodes: PricedNode[] = folded.nodes.map((seq) => {
    const event = bySeq.get(seq);
    if (event === undefined) throw new Error(`missing surface event ${seq}`);
    const message = deriveEventMessage(event);
    const text = message === null ? '' : messageText(message);
    return { seq, text, units: text.length };
  });
  return { nodes, totalUnits: nodes.reduce((sum, node) => sum + node.units, 0) };
}

/** Select the oldest contiguous surface prefix while retaining a recent tail budget. */
export function selectCompactableRange(
  events: readonly SessionEvent[],
  measurement: Measurement,
  retainUnits: number,
): { readonly startSeq: number; readonly endSeq: number; readonly shadowedSeqs: readonly number[] } | null {
  const folded = foldSurface(events);
  if (folded.nodes.length !== measurement.nodes.length
    || folded.nodes.some((seq, index) => seq !== measurement.nodes[index]?.seq)) {
    throw new Error('measurement does not match the current surface');
  }
  const firstIndex = folded.nodes.length > 0
    && events[folded.nodes[0]!]?.type === 'system/message' ? 1 : 0;

  let accumulated = 0;
  let keepFromIndex = folded.nodes.length;
  for (let index = folded.nodes.length - 1; index >= 0; index -= 1) {
    accumulated += measurement.nodes[index]?.units ?? 0;
    keepFromIndex = index;
    if (accumulated >= retainUnits) break;
  }
  if (keepFromIndex <= firstIndex) return null;

  const shadowedSeqs = folded.nodes.slice(firstIndex, keepFromIndex);
  if (shadowedSeqs.length === 0) return null;
  return {
    startSeq: shadowedSeqs[0]!,
    endSeq: shadowedSeqs.at(-1)!,
    shadowedSeqs,
  };
}
