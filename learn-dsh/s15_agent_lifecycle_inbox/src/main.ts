import { DemoAgentLoop } from './agent-loop.ts';
import type { UserMessage } from './types.ts';

function message(id: string, text: string): UserMessage {
  return { id, text, source: 'lesson-user' };
}

const loop = new DemoAgentLoop();

loop.onCreated(async (agent) => {
  console.log(`[created listener] begin; registry lookup=${loop.get(agent.id) === agent}`);
  agent.inject(message('context-1', '先按简洁方式回答。'));
  agent.followup(message('prompt-1', '解释 Agent Inbox 的用途。'));
  console.log(`[created listener] queued; status=${agent.status}; next-step=${agent.inbox.nextStep.length}; next-turn=${agent.inbox.nextTurn.length}`);
  await new Promise<void>((resolve) => setTimeout(resolve, 5));
  console.log('[created listener] finished');
});

const handle = await loop.create('session-15');
const agent = handle.agent;
console.log(`[consumer] create resolved; status=${agent.status}; live Agents=${loop.list().length}`);
await agent.whenIdle();
console.log(`[consumer] driver idle; status=${agent.status}; pending=${agent.inbox.nextStep.length + agent.inbox.nextTurn.length}`);

agent.inject(message('context-2', '这条输入不会自行唤醒 driver。'));
console.log(`[consumer] after inject; status=${agent.status}; next-step=${agent.inbox.nextStep.map(({ id }) => id).join(',')}`);
agent.inbox.clear();

await handle.dispose();
console.log(`[consumer] after dispose; registry lookup=${loop.get(agent.id) ?? 'undefined'}`);
console.log(`[session] durable inbox events=${agent.session.snapshot().length}`);
for (const event of agent.session.snapshot()) {
  const { target, removedCount = 0, inserted, outcome } = event.data;
  console.log(`  ${event.seq}: ${target} -${removedCount} +[${inserted.map(({ id }) => id).join(',')}]${outcome === undefined ? '' : ` (${outcome})`}`);
}
