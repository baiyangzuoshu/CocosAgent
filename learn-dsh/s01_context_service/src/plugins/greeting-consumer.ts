import type { Context } from '../context.ts';
import type { Plugin } from '../types.ts';
import type { GreeterService } from '../services/greeter.ts';

function apply(ctx: Context): void {
  ctx.log('greeting-consumer', ctx.greeter.greet('world'));
}

export const greetingConsumer: Plugin = {
  name: 'greeting-consumer',
  apply,
};
