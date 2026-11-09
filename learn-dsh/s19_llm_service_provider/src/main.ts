import { ChatClient } from './chat-client.ts';
import { FakeAdapter } from './fake-adapter.ts';
import { LlmRuntime } from './llm-runtime.ts';

const llm = new LlmRuntime();
const releaseAlpha = llm.registerAdapter(['fake-alpha'], new FakeAdapter('Fake Alpha', 'Alpha 回答'));
const releaseBeta = llm.registerAdapter(['fake-beta'], new FakeAdapter('Fake Beta', 'Beta 回答'));
const client = new ChatClient(llm);

console.log(`registered providers: ${JSON.stringify(llm.listProviders())}`);
const prompt = '统一接口把请求送到哪里？';
for (const provider of ['fake-alpha', 'fake-beta']) {
  // Same client method and request shape; only the selected provider route changes.
  console.log(`\nconsumer selects ${provider}`);
  console.log(`answer: ${await client.ask(provider, 'fake-chat', prompt)}`);
}

releaseBeta();
releaseAlpha();
console.log(`\nafter adapter disposal: ${JSON.stringify(llm.listProviders())}`);
