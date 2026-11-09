import type { Context } from './context.ts';
import type { HeadlessStartup } from './types.ts';

export async function runHeadless(ctx: Context): Promise<void> {
  const startup = ctx.require<HeadlessStartup>('headlessStartup');
  console.log('[headless-runner] create one Agent and submit the task');

  // A deterministic stand-in keeps this lesson independent of model credentials.
  const answer = `模拟答复：已收到任务「${startup.task}」`;
  await Promise.resolve();

  if (startup.json) {
    console.log(JSON.stringify({ type: 'final', text: answer }));
  } else {
    console.log(`结果：${answer}`);
  }
  console.log('[headless-runner] request process shutdown');
}
