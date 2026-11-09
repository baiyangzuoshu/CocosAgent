import type { SessionEvent, SessionEventDraft, UserMessage } from './types.ts';

export class SessionLog {
  #events: SessionEvent[] = [];

  append(event: SessionEventDraft): void {
    this.#events.push({ seq: this.#events.length, ...event } as SessionEvent);
  }

  snapshot(): readonly SessionEvent[] {
    return [...this.#events];
  }

  modelMessages(): readonly UserMessage[] {
    return this.#events.flatMap((event) => event.type === 'user/message' ? [event.data.message] : []);
  }
}
