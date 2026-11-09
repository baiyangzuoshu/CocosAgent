import type { EventInput, ModelMessage, SessionEvent } from "./types.ts";

/** Stores durable events and projects only surface messages into model history. */
export class SessionLog {
  #events: SessionEvent[] = [];

  append(event: EventInput, sourceEventSeqs?: readonly number[]): number {
    const seq = this.#events.length + 1;
    this.#events.push({
      ...structuredClone(event),
      seq,
      ...(sourceEventSeqs === undefined
        ? {}
        : { sourceEventSeqs: [...sourceEventSeqs] }),
    } as SessionEvent);
    return seq;
  }

  deriveMessages(): ModelMessage[] {
    const messages: ModelMessage[] = [];
    for (const event of this.#events) {
      switch (event.type) {
        case "user/message":
        case "assistant/message":
          messages.push(event.data.message);
          break;
        case "tool/result":
          messages.push(event.data.message);
          break;
      }
    }
    return structuredClone(messages);
  }

  snapshot(): SessionEvent[] {
    return structuredClone(this.#events);
  }
}
