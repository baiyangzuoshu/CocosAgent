import type { SessionEvent, SessionFrame } from "./types.ts";
import type { SessionLog } from "./session.ts";

export const REMOTE_MUX_PATH = "/api/remote.mux";

/** JSON wire carrier standing in for Gateway's browser WebSocket mux. */
export class LocalWebTransport {
  async *openSession(
    log: SessionLog,
    signal: AbortSignal,
  ): AsyncIterable<string> {
    for await (const frame of log.follow(signal)) yield JSON.stringify(frame);
  }
}

export interface BrowserState {
  readonly sessionId: string | undefined;
  readonly cursor: number;
  readonly status: "waiting" | "running" | "completed" | "error";
  readonly rows: readonly string[];
}

/** Browser-side Session projection and lifecycle owner for one event stream. */
export class BrowserConversation {
  readonly #listeners = new Set<() => void>();
  #state: BrowserState = {
    sessionId: undefined,
    cursor: 0,
    status: "waiting",
    rows: [],
  };
  #controller: AbortController | undefined;
  #consumer: Promise<void> | undefined;
  #failure: unknown;
  #opened = false;

  getSnapshot(): BrowserState {
    return this.#state;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async connect(
    open: (signal: AbortSignal) => AsyncIterable<string>,
  ): Promise<void> {
    const controller = new AbortController();
    this.#controller = controller;
    const iterator = open(controller.signal)[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (first.done) {
      throw new Error("Remote stream ended before its Session snapshot.");
    }
    const opening = decodeFrame(first.value);
    if (opening.type !== "snapshot") {
      throw new Error("Expected an opening Session snapshot.");
    }
    this.acceptSnapshot(opening.sessionId, opening.cursor, opening.events);
    this.#consumer = this.consume(iterator);
  }

  async waitForCursor(cursor: number): Promise<void> {
    if (this.#state.cursor >= cursor) return;
    await new Promise<void>((resolve) => {
      const stop = this.subscribe(() => {
        if (this.#state.cursor < cursor && this.#state.status !== "error") {
          return;
        }
        stop();
        resolve();
      });
    });
    if (this.#failure !== undefined) throw this.#failure;
    if (this.#state.cursor < cursor) {
      throw new Error("Stream ended before the requested cursor.");
    }
  }

  async dispose(): Promise<void> {
    this.#controller?.abort();
    await this.#consumer;
    this.#controller = undefined;
  }

  private async consume(iterator: AsyncIterator<string>): Promise<void> {
    try {
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        const frame = decodeFrame(next.value);
        if (frame.type === "snapshot") {
          throw new Error("Unexpected replacement snapshot.");
        }
        this.acceptEvent(frame.event);
      }
    } catch (error) {
      if (!this.#controller?.signal.aborted) {
        this.#failure = error;
        this.publish({ ...this.#state, status: "error" });
      }
    }
  }

  private acceptSnapshot(
    sessionId: string,
    cursor: number,
    events: readonly SessionEvent[],
  ): void {
    if (this.#opened) throw new Error("Session snapshot was already applied.");
    let expected = 1;
    const rows: string[] = [];
    let status: BrowserState["status"] = "waiting";
    for (const event of events) {
      if (event.seq !== expected) {
        throw new Error(`Snapshot gap at seq ${expected}.`);
      }
      expected += 1;
      status = projectEvent(event, rows, status);
    }
    if ((events.at(-1)?.seq ?? 0) !== cursor) {
      throw new Error("Snapshot cursor did not match its tail.");
    }
    this.#opened = true;
    this.publish({ sessionId, cursor, status, rows });
  }

  private acceptEvent(event: SessionEvent): void {
    if (!this.#opened) {
      throw new Error("Session event arrived before the snapshot.");
    }
    if (event.seq <= this.#state.cursor) return;
    if (event.seq !== this.#state.cursor + 1) {
      throw new Error(
        `Event gap: expected seq ${this.#state.cursor + 1}, got ${event.seq}.`,
      );
    }
    const rows = [...this.#state.rows];
    const status = projectEvent(event, rows, this.#state.status);
    this.publish({ ...this.#state, cursor: event.seq, status, rows });
  }

  private publish(state: BrowserState): void {
    this.#state = state;
    for (const listener of [...this.#listeners]) listener();
  }
}

/** Plain-text rendering stand-in for the browser Conversation components. */
export class ConversationView {
  readonly #stop: () => void;
  #renderCount = 0;

  constructor(private readonly conversation: BrowserConversation) {
    this.#stop = conversation.subscribe(() => this.render());
    this.render();
  }

  dispose(): void {
    this.#stop();
  }

  private render(): void {
    const { cursor, status, rows } = this.conversation.getSnapshot();
    this.#renderCount += 1;
    console.log(
      `[Web view ${this.#renderCount}] cursor=${cursor} status=${status}\n${
        rows.join("\n")
      }`,
    );
  }
}

function projectEvent(
  event: SessionEvent,
  rows: string[],
  currentStatus: BrowserState["status"],
): BrowserState["status"] {
  switch (event.type) {
    case "user/message":
      rows.push(`user> ${event.data.text}`);
      return currentStatus;
    case "turn/start":
      return "running";
    case "assistant/tool-call":
      rows.push(
        `assistant> 调用 ${event.data.name}(${
          JSON.stringify(event.data.arguments)
        })`,
      );
      return currentStatus;
    case "tool/call":
      return currentStatus;
    case "tool/result":
      rows.push(`tool> ${event.data.name}: ${event.data.content}`);
      return currentStatus;
    case "assistant/message":
      rows.push(`assistant> ${event.data.text}`);
      return currentStatus;
    case "turn/end":
      return event.data.reason === "completed" ? "completed" : currentStatus;
  }
}

function decodeFrame(encoded: string): SessionFrame {
  const value: unknown = JSON.parse(encoded);
  if (typeof value !== "object" || value === null || !("type" in value)) {
    throw new TypeError("Invalid Session wire frame.");
  }
  const frame = value as Record<string, unknown>;
  if (frame.type === "snapshot") {
    if (
      typeof frame.sessionId !== "string" || typeof frame.cursor !== "number" ||
      !Number.isSafeInteger(frame.cursor) || frame.cursor < 0 ||
      !Array.isArray(frame.events) ||
      !frame.events.every(isSessionEvent)
    ) {
      throw new TypeError("Invalid Session snapshot.");
    }
    return frame as unknown as SessionFrame;
  }
  if (frame.type === "event" && isSessionEvent(frame.event)) {
    return frame as unknown as SessionFrame;
  }
  throw new TypeError("Invalid Session event frame.");
}

function isSessionEvent(value: unknown): value is SessionEvent {
  if (
    typeof value !== "object" || value === null || !("type" in value) ||
    !("seq" in value) || !("data" in value)
  ) {
    return false;
  }
  const event = value as { type: unknown; seq: unknown; data: unknown };
  const eventTypes = [
    "user/message",
    "turn/start",
    "assistant/tool-call",
    "tool/call",
    "tool/result",
    "assistant/message",
    "turn/end",
  ];
  return typeof event.type === "string" && eventTypes.includes(event.type) &&
    typeof event.seq === "number" && Number.isSafeInteger(event.seq) &&
    event.seq > 0 &&
    typeof event.data === "object" && event.data !== null;
}
