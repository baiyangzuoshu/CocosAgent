import type { Context } from './context.ts';

export abstract class Service {
  protected constructor(ctx: Context, name: string) {
    ctx.provide(name, this);
  }
}
