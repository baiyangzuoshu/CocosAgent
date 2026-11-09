import { AsyncQueue } from "./async-queue.ts";
import type {
  ModelMessage,
  SessionEvent,
  SessionEventInput,
  SessionFrame,
} from "./types.ts";

/** Minimal durable Session log, also serving live observers. */
export class SessionLog {
  readonly #events: SessionEvent[] = [];
  readonly #listeners = new Set<(frame: SessionFrame) => void>();
  #nextSeq = 1;

  constructor(readonly id: string) {}

  get cursor(): number {
    return this.#nextSeq - 1;
  }

  snapshot(): readonly SessionEvent[] {
    return structuredClone(this.#events);
  }

  append(input: SessionEventInput): SessionEvent {
    const event = { ...input, seq: this.#nextSeq } as SessionEvent;
    this.#nextSeq += 1;
    this.#events.push(event);
    this.#publish({ type: "event", event });
    return event;
  }

  /** Attach the listener before fixing the opening history cut. */
  async *follow(signal: AbortSignal): AsyncIterable<SessionFrame> {
    signal.throwIfAborted();
    const queue = new AsyncQueue<SessionFrame>();
    const unsubscribe = this.subscribe((frame) => queue.push(frame));
    const close = (): void => queue.close();
    signal.addEventListener("abort", close, { once: true });

    try {
      yield {
        type: "snapshot",
        sessionId: this.id,
        cursor: this.cursor,
        events: this.snapshot(),
      };
      for await (const frame of queue) yield structuredClone(frame);
    } finally {
      signal.removeEventListener("abort", close);
      unsubscribe();
      queue.close();
    }
  }

  private subscribe(listener: (frame: SessionFrame) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #publish(frame: SessionFrame): void {
    for (const listener of [...this.#listeners]) {
      listener(structuredClone(frame));
    }
  }
}

/** Rebuild the model-facing conversation from committed Session facts. */
export function deriveHistory(events: readonly SessionEvent[]): ModelMessage[] {
  const history: ModelMessage[] = [];
  for (const event of events) {
    switch (event.type) {
      case "user/message":
        history.push({ role: "user", content: event.data.text });
        break;
      case "assistant/tool-call":
        history.push({ role: "assistant", toolCall: event.data });
        break;
      case "tool/result":
        history.push({ role: "tool", ...event.data });
        break;
      case "assistant/message":
        history.push({ role: "assistant", content: event.data.text });
        break;
      default:
        break;
    }
  }
  return history;
}
