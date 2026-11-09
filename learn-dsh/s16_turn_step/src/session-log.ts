import type { RequestMessage, SessionEvent, SessionEventDraft } from './types.ts';

/** Minimal append-only log with a model-visible history projection. */
export class SessionLog {
  #events: SessionEvent[] = [];

  append(event: SessionEventDraft): SessionEvent {
    const saved = { seq: this.#events.length, ...event } as SessionEvent;
    this.#events.push(saved);
    return saved;
  }

  snapshot(): readonly SessionEvent[] {
    return [...this.#events];
  }

  modelHistory(): RequestMessage[] {
    const messages: RequestMessage[] = [];
    for (const event of this.#events) {
      switch (event.type) {
        case 'user/message':
          messages.push({ role: 'user', content: event.data.text });
          break;
        case 'assistant/message':
          messages.push({
            role: 'assistant',
            content: event.data.text,
            ...(event.data.toolCalls.length === 0 ? {} : { toolCalls: event.data.toolCalls }),
          });
          break;
        case 'tool/result':
          messages.push({ role: 'tool', toolName: event.data.name, content: event.data.text });
          break;
      }
    }
    return messages;
  }
}
