import type { ModelMessage } from "./types.ts";

/** Each Agent owns its own append-only model-message history. */
export class SessionLog {
  #messages: ModelMessage[];

  constructor(
    readonly sessionId: string,
    seed: readonly ModelMessage[] = [],
  ) {
    this.#messages = [...structuredClone(seed)];
  }

  append(message: ModelMessage): void {
    this.#messages.push(structuredClone(message));
  }

  snapshot(): ModelMessage[] {
    return structuredClone(this.#messages);
  }
}
