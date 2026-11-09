import { ScriptedFakeLlm } from './fake-llm.ts';
import { SessionLog } from './session-log.ts';
import { TurnRunner } from './turn-runner.ts';
import type { FakeModelResponse, SessionEvent, UserMessage } from './types.ts';

const input: UserMessage = { id: 'user-1', text: '查询 SKU-14 的库存。' };
const script: readonly FakeModelResponse[] = [
  {
    text: '我先查一下库存。',
    toolCalls: [{ id: 'call-1', name: 'lookup_stock', arguments: '{"sku":"SKU-14"}' }],
  },
  { text: 'SKU-14 当前可用库存为 12 件。' },
];

const session = new SessionLog();
const runner = new TurnRunner(session, new ScriptedFakeLlm(script));
await runner.runTurn(input);

function describe(event: SessionEvent): string {
  switch (event.type) {
    case 'turn/start': return `turn/start turn=${event.data.turn}`;
    case 'turn/end': return `turn/end turn=${event.data.turn} reason=${event.data.reason.kind}`;
    case 'step/start': return `step/start turn=${event.data.turn} step=${event.data.step}`;
    case 'step/end': return `step/end turn=${event.data.turn} step=${event.data.step}`;
    case 'user/message': return `user/message ${event.data.id}`;
    case 'assistant/message': return `assistant/message step=${event.data.step}${event.data.toolCalls.length === 0 ? '' : ' (tool call)'}`;
    case 'tool/call': return `tool/call ${event.data.name} ${event.data.arguments}`;
    case 'tool/result': return `tool/result ${event.data.name}: ${event.data.text}`;
  }
}

const events = session.snapshot();
console.log('\nSession timeline:');
for (const event of events) console.log(`  @${event.seq} ${describe(event)}`);
console.log(`\nturns=${events.filter(({ type }) => type === 'turn/start').length}; steps=${events.filter(({ type }) => type === 'step/start').length}`);
