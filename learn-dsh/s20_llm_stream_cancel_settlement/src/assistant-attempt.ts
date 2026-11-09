import type { FinishReason, StreamChunk, TurnEndReason } from "./types.ts";

export type RecordInput =
  | {
    readonly type: "assistant/message";
    readonly turn: number;
    readonly step: number;
    readonly text: string;
    readonly stream: readonly StreamChunk[];
    readonly interrupted?: true;
  }
  | {
    readonly type: "assistant/attempt";
    readonly turn: number;
    readonly step: number;
    readonly stream: readonly StreamChunk[];
  }
  | {
    readonly type: "turn/end";
    readonly turn: number;
    readonly reason: TurnEndReason;
  };

export type DurableRecord = RecordInput extends infer T
  ? T extends RecordInput ? T & { readonly seq: number } : never
  : never;

export class SessionLog {
  #events: DurableRecord[] = [];

  append(event: RecordInput): number {
    const seq = this.#events.length + 1;
    this.#events.push({ ...structuredClone(event), seq } as DurableRecord);
    return seq;
  }

  snapshot(): DurableRecord[] {
    return structuredClone(this.#events);
  }
}

export type AssistantStreamFrame =
  | { readonly type: "start"; readonly attemptId: string }
  | {
    readonly type: "chunk";
    readonly attemptId: string;
    readonly index: number;
    readonly chunk: StreamChunk;
  }
  | {
    readonly type: "end";
    readonly attemptId: string;
    readonly index: number;
    readonly outcome: {
      readonly kind: "committed";
      readonly eventType: "assistant/message" | "assistant/attempt";
      readonly seq: number;
    } | { readonly kind: "abandoned" };
  };

/** Collects live chunks and commits exactly one durable assistant outcome. */
export class AssistantStreamAttempt {
  #chunks: StreamChunk[] = [];
  #visibleText = "";
  #finish: FinishReason = { kind: "stop" };
  #ended = false;

  constructor(
    private readonly session: SessionLog,
    private readonly turn: number,
    private readonly step: number,
    readonly attemptId: string,
    private readonly emit: (frame: AssistantStreamFrame) => void,
  ) {}

  get ended(): boolean {
    return this.#ended;
  }
  get visibleText(): string {
    return this.#visibleText;
  }
  get finish(): FinishReason {
    return this.#finish;
  }

  start(): void {
    this.emit({ type: "start", attemptId: this.attemptId });
  }

  push(chunk: StreamChunk): void {
    const copy = structuredClone(chunk);
    const index = this.#chunks.length;
    this.#chunks.push(copy);
    if (copy.type === "text-delta") this.#visibleText += copy.text;
    if (copy.type === "finish") this.#finish = copy.reason;
    this.emit({ type: "chunk", attemptId: this.attemptId, index, chunk: copy });
  }

  settleMessage(interrupted = false): void {
    this.commit("assistant/message", () =>
      this.session.append({
        type: "assistant/message",
        turn: this.turn,
        step: this.step,
        text: this.#visibleText,
        stream: this.#chunks,
        ...(interrupted ? { interrupted: true as const } : {}),
      }));
  }

  settleAttempt(): void {
    this.commit("assistant/attempt", () =>
      this.session.append({
        type: "assistant/attempt",
        turn: this.turn,
        step: this.step,
        stream: this.#chunks,
      }));
  }

  private commit(
    eventType: "assistant/message" | "assistant/attempt",
    append: () => number,
  ): void {
    if (this.#ended) throw new Error("assistant attempt already settled");
    let seq: number;
    try {
      seq = append();
    } catch (error: unknown) {
      this.abandon();
      throw error;
    }
    this.#ended = true;
    this.emit({
      type: "end",
      attemptId: this.attemptId,
      index: this.#chunks.length,
      outcome: { kind: "committed", eventType, seq },
    });
  }

  private abandon(): void {
    this.#ended = true;
    this.emit({
      type: "end",
      attemptId: this.attemptId,
      index: this.#chunks.length,
      outcome: { kind: "abandoned" },
    });
  }
}
