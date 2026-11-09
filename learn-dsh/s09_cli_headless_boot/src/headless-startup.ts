import type { Context } from './context.ts';
import type { HeadlessStartup } from './types.ts';

export function startHeadlessStartup(ctx: Context): void {
  const args = ctx.require<readonly string[]>('cmdlineArgs');
  let json = false;
  const taskParts: string[] = [];

  for (const argument of args) {
    if (argument === '--json') {
      json = true;
    } else if (argument.startsWith('-')) {
      throw new Error(`headless does not recognize option: ${argument}`);
    } else {
      taskParts.push(argument);
    }
  }

  const task = taskParts.join(' ');
  if (task.trim() === '') throw new Error('headless requires a task');

  const startup: HeadlessStartup = { task, json };
  ctx.provide('headlessStartup', startup);
  console.log('[headless-startup] provided headlessStartup');
}
