import type { InboxSpliceEvent, InboxState } from './types.ts';

type NewSplice = Omit<InboxSpliceEvent, 'seq' | 'type'>;
type Listener = (event: InboxSpliceEvent) => void;

/** Small append-only Session event log for the inbox's durable mutations. */
export class SessionLog {
  #events: InboxSpliceEvent[] = [];
  #listeners = new Set<Listener>();

  constructor(readonly id: string) {}

  get events(): readonly InboxSpliceEvent[] {
    return this.snapshot();
  }

  snapshot(): readonly InboxSpliceEvent[] {
    return [...this.#events];
  }

  appendInboxSplice(data: NewSplice['data']): InboxSpliceEvent {
    const event: InboxSpliceEvent = {
      seq: this.#events.length,
      type: 'agent/inbox/spliced',
      data: { ...data, inserted: [...data.inserted] },
    };
    this.#events.push(event);
    for (const listener of this.#listeners) listener(event);
    return event;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }
}

/** Rebuilds pending inbox state by folding the Session's durable splice events. */
export class InboxProjection {
  #state: InboxState = { nextTurn: [], nextStep: [] };

  constructor(history: readonly InboxSpliceEvent[] = []) {
    for (const event of history) this.apply(event);
  }

  snapshot(): InboxState {
    return {
      nextTurn: [...this.#state.nextTurn],
      nextStep: [...this.#state.nextStep],
    };
  }

  apply(event: InboxSpliceEvent): void {
    const { target, start, inserted } = event.data;
    const removedCount = event.data.removedCount ?? 0;
    const key = target === 'next-turn' ? 'nextTurn' : 'nextStep';
    const current = this.#state[key];
    if (!Number.isSafeInteger(start) || start < 0 || start > current.length
      || !Number.isSafeInteger(removedCount) || removedCount < 0
      || start + removedCount > current.length) {
      throw new Error(`invalid inbox splice at session seq ${event.seq}`);
    }

    const next = [...current];
    next.splice(start, removedCount, ...inserted);
    const other = key === 'nextTurn' ? this.#state.nextStep : this.#state.nextTurn;
    const ids = new Set<string>();
    for (const message of [...next, ...other]) {
      if (ids.has(message.id)) throw new Error(`message "${message.id}" is already pending`);
      ids.add(message.id);
    }
    this.#state = key === 'nextTurn'
      ? { nextTurn: next, nextStep: this.#state.nextStep }
      : { nextTurn: this.#state.nextTurn, nextStep: next };
  }
}
