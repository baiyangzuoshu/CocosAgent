import type { Context } from '../context.ts';
import { Service } from '../service.ts';

export class GreeterService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'greeter');
  }

  greet(who: string): string {
    return `Hello, ${who}!`;
  }
}

declare module '../context.ts' {
  interface Context {
    greeter: GreeterService;
  }
}
