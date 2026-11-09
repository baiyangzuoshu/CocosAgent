import type { GenerateOptions, LlmAdapter, ProviderInfo, StreamChunk } from './types.ts';

/** A provider-neutral fake with a provider-specific answer prefix. */
export class FakeAdapter implements LlmAdapter {
  constructor(
    private readonly displayName: string,
    private readonly answerPrefix: string,
  ) {}

  providerInfo(provider: string): ProviderInfo {
    return { id: provider, name: this.displayName };
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const prompt = options.messages
      .flatMap(({ content }) => content.map(({ text }) => text))
      .join('\n');
    const answer = `${this.answerPrefix}（${options.model}）：${prompt}`;
    const pieces = [this.answerPrefix, `（${options.model}）：`, prompt];

    console.log(`[adapter:${options.provider}] received one ${options.messages.length}-message request`);
    yield { type: 'block-start', index: 0, blockType: 'text' };
    for (const text of pieces) {
      if (text.length === 0) continue;
      yield { type: 'text-delta', index: 0, text };
      await Promise.resolve();
    }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: answer } };
    yield { type: 'usage', inputTokens: prompt.length, outputTokens: answer.length };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}
