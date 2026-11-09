import type { SessionEvent, SessionFrame, SessionProjection } from "./types.ts";
import { SessionProjectionStore } from "./session-projection.ts";

/** Browser-side consumer: decode wire frames and update the observable projection. */
export class BrowserSession {
  readonly #store: SessionProjectionStore;
  #controller: AbortController | undefined;
  #consumeTask: Promise<void> | undefined;
  #failure: unknown;

  constructor(store: SessionProjectionStore) {
    this.#store = store;
  }

  async connect(
    open: (signal: AbortSignal) => AsyncIterable<string>,
  ): Promise<void> {
    if (this.#controller) {
      throw new Error("Browser Session is already connected.");
    }
    const controller = new AbortController();
    this.#controller = controller;
    const iterator = open(controller.signal)[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (first.done) {
      throw new Error("Host stream ended before its opening snapshot.");
    }
    const opening = decodeFrame(first.value);
    if (opening.type !== "snapshot") {
      throw new Error("Host stream must begin with a Session snapshot.");
    }
    this.#store.accept(opening);
    this.#consumeTask = this.consume(iterator);
  }

  async waitForCursor(cursor: number): Promise<void> {
    await this.#store.waitFor((snapshot) =>
      snapshot.cursor >= cursor || snapshot.status === "error"
    );
    if (this.#failure !== undefined) throw this.#failure;
    if (this.#store.getSnapshot().cursor < cursor) {
      throw new Error(
        "Session stream failed before reaching the requested cursor.",
      );
    }
  }

  async dispose(): Promise<void> {
    this.#controller?.abort();
    await this.#consumeTask;
    this.#controller = undefined;
  }

  private async consume(iterator: AsyncIterator<string>): Promise<void> {
    try {
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        this.#store.accept(decodeFrame(next.value));
      }
    } catch (error) {
      if (!this.#controller?.signal.aborted) {
        this.#failure = error;
        this.#store.acceptFailure();
      }
    }
  }
}

function decodeFrame(encoded: string): SessionFrame {
  const frame = asRecord(JSON.parse(encoded));
  if (frame.type === "snapshot") {
    if (
      typeof frame.sessionId !== "string" || !isInteger(frame.cursor) ||
      !Array.isArray(frame.events)
    ) throw new TypeError("Host sent a malformed Session snapshot.");
    return {
      type: "snapshot",
      sessionId: frame.sessionId,
      cursor: frame.cursor,
      events: frame.events.map(parseSessionEvent),
    };
  }
  if (frame.type === "event") {
    return { type: "event", event: parseSessionEvent(frame.event) };
  }
  if (frame.type === "assistant-stream") {
    if (
      typeof frame.attemptId !== "string" || !isInteger(frame.revision) ||
      typeof frame.text !== "string"
    ) throw new TypeError("Host sent a malformed assistant stream frame.");
    return {
      type: "assistant-stream",
      attemptId: frame.attemptId,
      revision: frame.revision,
      text: frame.text,
    };
  }
  throw new TypeError("Host sent an unknown Session frame type.");
}

function parseSessionEvent(value: unknown): SessionEvent {
  const event = asRecord(value);
  const data = asRecord(event.data);
  if (!isInteger(event.seq)) {
    throw new TypeError("Session event seq must be an integer.");
  }
  switch (event.type) {
    case "user/message":
      if (typeof data.text !== "string") {
        throw new TypeError("Invalid user/message event.");
      }
      return {
        type: "user/message",
        seq: event.seq,
        data: { text: data.text },
      };
    case "turn/start":
      if (!isInteger(data.turn)) {
        throw new TypeError("Invalid turn/start event.");
      }
      return { type: "turn/start", seq: event.seq, data: { turn: data.turn } };
    case "assistant/message":
      if (
        !isInteger(data.turn) || typeof data.attemptId !== "string" ||
        typeof data.text !== "string"
      ) throw new TypeError("Invalid assistant/message event.");
      return {
        type: "assistant/message",
        seq: event.seq,
        data: { turn: data.turn, attemptId: data.attemptId, text: data.text },
      };
    case "turn/end":
      if (!isInteger(data.turn) || data.reason !== "completed") {
        throw new TypeError("Invalid turn/end event.");
      }
      return {
        type: "turn/end",
        seq: event.seq,
        data: { turn: data.turn, reason: "completed" },
      };
    default:
      throw new TypeError(`Unknown Session event: ${String(event.type)}`);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a JSON object frame.");
  }
  return value as Record<string, unknown>;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** A small view that exposes the same cached snapshot a UI hook would read. */
export class ConversationView {
  readonly #stop: () => void;
  #renderCount = 0;

  constructor(private readonly store: SessionProjectionStore) {
    this.#stop = store.subscribe(() => this.render());
    this.render();
  }

  dispose(): void {
    this.#stop();
  }

  private render(): void {
    const state: SessionProjection = this.store.getSnapshot();
    this.#renderCount += 1;
    const rows = state.rows.map(({ role, text }) => `${role}> ${text}`);
    if (state.liveText !== "") {
      rows.push(`assistant (streaming)> ${state.liveText}▌`);
    }
    console.log(
      `[Browser render ${this.#renderCount}] cursor=${state.cursor} status=${state.status}\n${
        rows.join("\n")
      }`,
    );
  }
}
