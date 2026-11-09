import type {
  AssistantStreamFrame,
  SessionEvent,
  SessionFrame,
  SessionProjection,
  SessionSnapshotFrame,
} from "./types.ts";

/** Client-side observable view derived from a snapshot and ordered deltas. */
export class SessionProjectionStore {
  readonly #listeners = new Set<() => void>();
  #snapshot: SessionProjection = {
    sessionId: undefined,
    cursor: 0,
    status: "waiting",
    rows: [],
    liveText: "",
    revision: 0,
  };
  #opened = false;
  #liveAttemptId: string | undefined;
  #liveRevision = 0;

  getSnapshot(): SessionProjection {
    return this.#snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  accept(frame: SessionFrame): void {
    if (frame.type === "snapshot") {
      this.acceptSnapshot(frame);
      return;
    }
    if (!this.#opened) {
      throw new Error("Session stream sent a delta before its snapshot.");
    }

    if (frame.type === "assistant-stream") {
      this.acceptAssistantStream(frame);
      return;
    }

    const event = frame.event;
    if (event.seq <= this.#snapshot.cursor) return;
    if (event.seq !== this.#snapshot.cursor + 1) {
      throw new Error(
        `Session event gap: expected ${
          this.#snapshot.cursor + 1
        }, got ${event.seq}`,
      );
    }

    const rows = [...this.#snapshot.rows];
    let status = this.#snapshot.status;
    let liveText = this.#snapshot.liveText;
    if (event.type === "user/message") {
      rows.push({ role: "user", text: event.data.text });
    }
    if (event.type === "turn/start") status = "running";
    if (event.type === "assistant/message") {
      rows.push({ role: "assistant", text: event.data.text });
      if (event.data.attemptId === this.#liveAttemptId) {
        liveText = "";
        this.#liveAttemptId = undefined;
        this.#liveRevision = 0;
      }
    }
    if (event.type === "turn/end") status = "completed";

    this.publish({
      ...this.#snapshot,
      cursor: event.seq,
      status,
      rows,
      liveText,
      revision: this.#snapshot.revision + 1,
    });
  }

  async waitFor(
    predicate: (snapshot: SessionProjection) => boolean,
  ): Promise<void> {
    if (predicate(this.#snapshot)) return;
    await new Promise<void>((resolve) => {
      const stop = this.subscribe(() => {
        if (!predicate(this.#snapshot)) return;
        stop();
        resolve();
      });
    });
  }

  acceptFailure(): void {
    this.publish({
      ...this.#snapshot,
      status: "error",
      revision: this.#snapshot.revision + 1,
    });
  }

  private acceptSnapshot(frame: SessionSnapshotFrame): void {
    if (this.#opened) {
      throw new Error("Session stream sent more than one opening snapshot.");
    }
    let expectedSeq = frame.events[0]?.seq ?? frame.cursor + 1;
    const rows = [] as Array<{ role: "user" | "assistant"; text: string }>;
    let status: SessionProjection["status"] = "waiting";
    for (const event of frame.events) {
      if (event.seq !== expectedSeq) {
        throw new Error(
          `Snapshot is discontinuous at sequence ${expectedSeq}.`,
        );
      }
      expectedSeq += 1;
      status = projectEvent(event, rows, status);
    }
    const lastSeq = frame.events.at(-1)?.seq ?? 0;
    if (frame.cursor !== lastSeq) {
      throw new Error(
        `Snapshot cursor ${frame.cursor} does not match its tail ${lastSeq}.`,
      );
    }
    this.#opened = true;
    this.publish({
      sessionId: frame.sessionId,
      cursor: frame.cursor,
      status,
      rows,
      liveText: "",
      revision: this.#snapshot.revision + 1,
    });
  }

  private acceptAssistantStream(frame: AssistantStreamFrame): void {
    if (frame.attemptId !== this.#liveAttemptId) {
      if (frame.revision !== 1) {
        throw new Error(
          `Assistant stream began at revision ${frame.revision}, expected 1.`,
        );
      }
      this.#liveAttemptId = frame.attemptId;
      this.#liveRevision = 0;
      this.#snapshot = { ...this.#snapshot, liveText: "" };
    }
    if (frame.revision <= this.#liveRevision) return;
    if (frame.revision !== this.#liveRevision + 1) {
      throw new Error(
        `Assistant stream gap: expected ${
          this.#liveRevision + 1
        }, got ${frame.revision}`,
      );
    }
    this.#liveRevision = frame.revision;
    this.publish({
      ...this.#snapshot,
      liveText: this.#snapshot.liveText + frame.text,
      revision: this.#snapshot.revision + 1,
    });
  }

  private publish(snapshot: SessionProjection): void {
    this.#snapshot = snapshot;
    for (const listener of [...this.#listeners]) listener();
  }
}

function projectEvent(
  event: SessionEvent,
  rows: Array<{ role: "user" | "assistant"; text: string }>,
  currentStatus: SessionProjection["status"],
): SessionProjection["status"] {
  if (event.type === "user/message") {
    rows.push({ role: "user", text: event.data.text });
  }
  if (event.type === "assistant/message") {
    rows.push({ role: "assistant", text: event.data.text });
  }
  if (event.type === "turn/start") return "running";
  if (event.type === "turn/end") return "completed";
  return currentStatus;
}
