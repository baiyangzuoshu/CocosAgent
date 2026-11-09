import type { ModelRequest } from "./types.ts";

/** A deterministic stand-in that records the exact history given to a model. */
export class FakeLLM {
  readonly requests: ModelRequest[] = [];
  #responses: string[];

  constructor(responses: readonly string[]) {
    this.#responses = [...responses];
  }

  async complete(request: ModelRequest): Promise<string> {
    this.requests.push(structuredClone(request));
    const response = this.#responses.shift();
    if (response === undefined) {
      throw new Error("FakeLLM has no scripted response");
    }
    return response;
  }
}
