import type { Context } from '../context.ts';
import type { Plugin } from '../types.ts';
import { GreeterService } from '../services/greeter.ts';

function apply(ctx: Context): void {
  new GreeterService(ctx);
}

export const greeterProvider: Plugin = {
  name: 'greeter-provider',
  apply,
};
