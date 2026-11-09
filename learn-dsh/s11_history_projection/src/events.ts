import type { EventInput, SessionEvent } from './types.ts';

const surfaceTypes = new Set(['system/message', 'developer/message', 'user/message', 'assistant/message', 'tool/result']);

function freezeSnapshot<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const child of value) freezeSnapshot(child);
  } else if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) freezeSnapshot(child);
  }
  return Object.freeze(value);
}

/** A tiny in-memory append-only log, independent of the previous lesson. */
export class EventLog {
  private readonly events: SessionEvent[] = [];

  get seq(): number {
    return this.events.length;
  }

  append(input: EventInput): SessionEvent {
    const isSurfaceEvent = surfaceTypes.has(input.type);
    if (isSurfaceEvent && input.surfaceOp === undefined) {
      throw new Error(`surface event "${input.type}" requires surfaceOp`);
    }
    if (!isSurfaceEvent && (input.surfaceOp !== undefined || input.sourceEventSeqs !== undefined)) {
      throw new Error(`log-only event "${input.type}" cannot carry surface metadata`);
    }
    if (input.type === 'assistant/message' && input.sourceEventSeqs !== undefined) {
      throw new Error('assistant/message embeds its source stream and cannot carry sourceEventSeqs');
    }

    const event = Object.freeze({
      ...input,
      data: freezeSnapshot(structuredClone(input.data)),
      ...(input.surfaceOp === undefined ? {} : { surfaceOp: freezeSnapshot(structuredClone(input.surfaceOp)) }),
      ...(input.sourceEventSeqs === undefined
        ? {}
        : { sourceEventSeqs: freezeSnapshot(structuredClone(input.sourceEventSeqs)) }),
      seq: this.events.length,
      time: 1_700_000_000_000 + this.events.length,
    });
    this.events.push(event);
    return event;
  }

  snapshot(): readonly SessionEvent[] {
    return Object.freeze([...this.events]);
  }
}
