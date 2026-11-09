import type { UserMessage } from './types.ts';

export class FakeLlm {
  #requestCount = 0;

  constructor(private readonly trace: (line: string) => void) {}

  get requestCount(): number {
    return this.#requestCount;
  }

  async request(turn: number, step: number, messages: readonly UserMessage[]): Promise<string> {
    this.#requestCount += 1;
    const prompt = messages.map(({ text }) => text).join(' | ');
    this.trace(`[Fake LLM] request ${turn}.${step}: ${prompt}`);
    await Promise.resolve();
    return `已处理：${prompt}`;
  }
}
