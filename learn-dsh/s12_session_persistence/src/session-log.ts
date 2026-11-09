import type { EventInput, SessionEvent } from './types.ts';

export type EventListener = (event: SessionEvent) => void;

/** A small in-memory Session log that synchronously publishes appended events. */
export class SessionLog {
  private readonly events: SessionEvent[];
  private readonly listeners = new Set<EventListener>();

  constructor(seed: readonly SessionEvent[] = []) {
    this.events = [...seed];
  }

  get nextSeq(): number {
    return this.events.length;
  }

  append(input: EventInput): SessionEvent {
    const event = Object.freeze({
      ...structuredClone(input),
      seq: this.events.length,
      time: 1_700_000_000_000 + this.events.length,
    });
    this.events.push(event);
    for (const listener of this.listeners) listener(event);
    return event;
  }

  snapshot(): readonly SessionEvent[] {
    return Object.freeze([...this.events]);
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
