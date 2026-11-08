import type { Context } from './context.ts';
import type { Plugin } from './types.ts';

export class Loader {
  private readonly pending: Plugin[] = [];
  private readonly announced = new Set<Plugin>();

  constructor(private readonly ctx: Context) {}

  async load(plugins: readonly Plugin[]): Promise<void> {
    this.pending.push(...plugins);
    await this.activateReady();
  }

  private async activateReady(): Promise<void> {
    let madeProgress: boolean;
    do {
      madeProgress = false;
      for (let index = 0; index < this.pending.length;) {
        const plugin = this.pending[index];
        if (!plugin) {
          index += 1;
          continue;
        }

        const missing = (plugin.inject ?? []).filter((name) => !this.ctx.hasService(name));
        if (missing.length > 0) {
          if (!this.announced.has(plugin)) {
            console.log(`[loader] pending ${plugin.name}; waiting for ${missing.join(', ')}`);
            this.announced.add(plugin);
          }
          index += 1;
          continue;
        }

        this.pending.splice(index, 1);
        this.announced.delete(plugin);
        console.log(`[loader] loading ${plugin.name}`);
        await plugin.apply(this.ctx);
        console.log(`[loader] loaded ${plugin.name}`);
        madeProgress = true;
      }
    } while (madeProgress);
  }
}
