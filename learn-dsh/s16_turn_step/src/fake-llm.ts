import type { FakeModelResponse, LlmRequest } from './types.ts';

/** Deterministic provider script: request one tool, then answer from its result. */
export class ScriptedFakeLlm {
  #next = 0;

  constructor(private readonly script: readonly FakeModelResponse[]) {}

  async request(request: LlmRequest): Promise<FakeModelResponse> {
    const response = this.script[this.#next];
    if (response === undefined) throw new Error(`Fake LLM has no response for request ${this.#next + 1}`);
    this.#next += 1;

    const history = request.messages.map((message) => {
      if (message.role === 'assistant' && message.toolCalls !== undefined) {
        return `assistant: ${message.content} [tool-call ${message.toolCalls.map(({ name }) => name).join(', ')}]`;
      }
      if (message.role === 'tool') return `tool(${message.toolName}): ${message.content}`;
      return `${message.role}: ${message.content}`;
    }).join(' → ');
    console.log(`[Fake LLM] request ${request.turn}.${request.step}: ${history}`);
    console.log(`[Fake LLM] response: ${response.text}${response.toolCalls === undefined ? '' : `; calls=${response.toolCalls.map(({ name }) => name).join(',')}`}`);
    return response;
  }
}
