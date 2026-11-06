import type { Context, Plugin } from '../types.ts';

function apply(ctx: Context): void {
  ctx.log('hello', 'hello from my first plugin');
}

export const helloPlugin: Plugin = {
  name: 'hello',
  apply,
};
