import type { EventInput, SessionEvent } from './types.ts';

const surfaceTypes = new Set(['system/message', 'developer/message', 'user/message', 'assistant/message', 'tool/result']);

export class EventLog {
  private readonly events: SessionEvent[] = [];

  append(input: EventInput): SessionEvent {
    const isSurfaceEvent = surfaceTypes.has(input.type);
    if (isSurfaceEvent && input.surfaceOp === undefined) throw new Error(`${input.type} requires surfaceOp`);
    if (!isSurfaceEvent && (input.surfaceOp !== undefined || input.sourceEventSeqs !== undefined)) {
      throw new Error(`${input.type} is log-only and cannot carry surface metadata`);
    }
    if (input.type === 'assistant/message' && input.sourceEventSeqs !== undefined) {
      throw new Error('assistant/message cannot carry sourceEventSeqs');
    }

    const event = Object.freeze({
      ...structuredClone(input),
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
