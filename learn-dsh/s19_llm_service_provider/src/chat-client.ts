import { LlmRuntime } from './llm-runtime.ts';
import type { GenerateOptions } from './types.ts';

/** Consumer knows the unified LLM stream contract, not an adapter class. */
export class ChatClient {
  constructor(private readonly llm: LlmRuntime) {}

  async ask(provider: string, model: string, prompt: string): Promise<string> {
    const options: GenerateOptions = {
      provider,
      model,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    };
    let output = '';
    for await (const chunk of this.llm.stream(options)) {
      if (chunk.type === 'text-delta') output += chunk.text;
      if (chunk.type === 'finish' && chunk.reason.kind !== 'stop') {
        throw new Error(`${chunk.reason.failure?.code ?? 'LLM_ERROR'}: ${chunk.reason.failure?.message ?? 'request failed'}`);
      }
    }
    return output;
  }
}
