import type { SessionEvent } from './types.ts';

/** Repair one interrupted final turn with the closer events needed by this lesson. */
export function interruptedTurnClosers(events: readonly SessionEvent[]): SessionEvent[] {
  let openTurn: number | undefined;
  let openStep: { readonly turn: number; readonly step: number } | undefined;

  for (const event of events) {
    const data = event.data as { readonly turn?: number; readonly step?: number };
    if (event.type === 'turn/start') {
      openTurn = data.turn;
      openStep = undefined;
    } else if (event.type === 'step/start') {
      openStep = data.turn === undefined || data.step === undefined
        ? undefined
        : { turn: data.turn, step: data.step };
    } else if (event.type === 'step/end') {
      openStep = undefined;
    } else if (event.type === 'turn/end') {
      openTurn = undefined;
      openStep = undefined;
    }
  }

  if (openTurn === undefined) return [];
  const time = events.at(-1)?.time ?? 1_700_000_000_000;
  const closers: SessionEvent[] = [];
  if (openStep?.turn === openTurn) {
    closers.push({
      type: 'step/end',
      seq: events.length,
      time,
      data: { turn: openTurn, step: openStep.step },
    });
  }
  closers.push({
    type: 'turn/end',
    seq: events.length + closers.length,
    time,
    data: { turn: openTurn, reason: { kind: 'interrupted' } },
  });
  return closers;
}
