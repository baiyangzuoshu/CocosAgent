import { AsyncQueue } from "./async-queue.ts";
import type { SessionEvent, SessionEventInput, SessionFrame } from "./types.ts";

/** Host-owned durable Session log plus live listeners. */
export class HostSession {
  readonly #events: SessionEvent[] = [];
  readonly #listeners = new Set<(frame: SessionFrame) => void>();
  #nextSeq = 1;

  constructor(readonly id: string) {}

  get cursor(): number {
    return this.#nextSeq - 1;
  }

  append(input: SessionEventInput): SessionEvent {
    const event = { ...input, seq: this.#nextSeq } as SessionEvent;
    this.#nextSeq += 1;
    this.#events.push(event);
    this.#publish({ type: "event", event });
    return event;
  }

  publishAssistantChunk(frame: {
    readonly attemptId: string;
    readonly revision: number;
    readonly text: string;
  }): void {
    this.#publish({ type: "assistant-stream", ...frame });
  }

  /** Subscribe first, then send a snapshot cut and all later frames. */
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
        events: structuredClone(this.#events),
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
