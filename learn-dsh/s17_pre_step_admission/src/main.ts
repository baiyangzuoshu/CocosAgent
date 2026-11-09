import { FakeLlm } from './fake-llm.ts';
import { PreStepChain } from './pre-step.ts';
import { SessionLog } from './session-log.ts';
import { TurnRunner } from './turn-runner.ts';
import type { PreStepDecision, PreStepPayload, UserMessage } from './types.ts';

function makeChain(trace: (line: string) => void): PreStepChain {
  const chain = new PreStepChain();

  // An observing/wrapping listener calls next() to preserve downstream behavior.
  chain.use(async ({ messages, turn, step }, next) => {
    trace(`[observer] candidates=${messages.map(({ text }) => text).join(' | ')} at ${turn}.${step}`);
    const decision = await next();
    trace(`[observer] downstream returned ${decision.kind}`);
    return decision;
  });

  // This listener deliberately short-circuits [reject], and otherwise rewrites
  // or removes the batch returned by the default enter decision.
  chain.use(async (payload: PreStepPayload, next): Promise<PreStepDecision> => {
    const text = payload.messages.map(({ text: value }) => value).join(' ');
    if (text.includes('[reject]')) return { kind: 'reject' };

    const decision = await next();
    if (decision.kind === 'reject') return decision;
    if (text.includes('[empty]')) return { ...decision, messages: [] };
    if (text.includes('[rewrite]')) {
      return {
        ...decision,
        messages: decision.messages.map((message) => ({
          ...message,
          text: message.text.replace('[rewrite]', '[已标注为只读请求]'),
        })),
      };
    }
    return decision;
  });

  return chain;
}

function formatEvent(event: ReturnType<SessionLog['snapshot']>[number]): string {
  switch (event.type) {
    case 'turn/start': return 'turn/start';
    case 'turn/end': return `turn/end ${event.data.reason.kind}`;
    case 'step/start': return 'step/start';
    case 'step/end': return 'step/end';
    case 'user/message': return `user/message "${event.data.message.text}"`;
    case 'assistant/message': return `assistant/message "${event.data.text}"`;
  }
}

const scenarios: readonly { readonly name: string; readonly text: string }[] = [
  { name: '默认接纳', text: '查询项目状态' },
  { name: '改写后接纳', text: '[rewrite] 检查 deploy 配置' },
  { name: '拒绝', text: '[reject] 执行危险操作' },
  { name: '空批次', text: '[empty] 只包含内部标记' },
];

for (const [index, scenario] of scenarios.entries()) {
  console.log(`\n--- ${scenario.name} ---`);
  const trace = (line: string): void => console.log(line);
  const session = new SessionLog();
  const llm = new FakeLlm(trace);
  const runner = new TurnRunner(session, makeChain(trace), llm, trace);
  const input: UserMessage = { id: `message-${index + 1}`, text: scenario.text, source: 'lesson-user' };

  await runner.runTurn(input);
  const events = session.snapshot();
  console.log(`[result] model requests=${llm.requestCount}; events=${events.map(formatEvent).join(' → ')}`);
}
