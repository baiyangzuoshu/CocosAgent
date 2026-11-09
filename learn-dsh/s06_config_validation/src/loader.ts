import type { Context } from './types.ts';
import type { Plugin } from './types.ts';

export class Loader {
  constructor(private readonly ctx: Context) {}

  async load<TConfig>(plugin: Plugin<TConfig>, rawConfig: unknown): Promise<void> {
    console.log(`[loader] validating ${plugin.name}`);
    const config = plugin.Config.parse(rawConfig);
    console.log(`[loader] loading ${plugin.name}`);
    await plugin.apply(this.ctx, config);
    console.log(`[loader] loaded ${plugin.name}`);
  }
}
