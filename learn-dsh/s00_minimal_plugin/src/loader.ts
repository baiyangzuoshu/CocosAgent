import type { Context, Plugin } from './types.ts';

export async function mount(ctx: Context, plugin: Plugin): Promise<void> {
  console.log(`[loader] loading ${plugin.name}`);
  await plugin.apply(ctx);
  console.log(`[loader] loaded ${plugin.name}`);
}
