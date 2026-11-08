import { Context } from './context.ts';
import { Fiber } from './fiber.ts';
import type { MessageSource, Plugin } from './types.ts';

export class Loader {
  constructor(private readonly messages: MessageSource) {}

  async mount(plugin: Plugin): Promise<Fiber> {
    const ctx = new Context(this.messages);
    console.log(`[loader] loading ${plugin.name}`);
    try {
      await plugin.apply(ctx);
    } catch (error) {
      await ctx.disposeEffects();
      throw error;
    }
    console.log(`[loader] loaded ${plugin.name}`);
    return new Fiber(plugin.name, ctx);
  }
}
