import type { Context as ContextApi, Disposer, MessageSource } from './types.ts';

export class Context implements ContextApi {
  private readonly effects: Disposer[] = [];

  constructor(readonly messages: MessageSource) {}

  effect(setup: () => void | Disposer): Disposer {
    const cleanup = setup();
    let active = true;

    const dispose: Disposer = async () => {
      if (!active) return;
      active = false;
      if (cleanup) await cleanup();
    };

    this.effects.push(dispose);
    return dispose;
  }

  async disposeEffects(): Promise<void> {
    const effects = this.effects.splice(0).reverse();
    for (const dispose of effects) {
      await dispose();
    }
  }

  log(source: string, message: string): void {
    console.log(`[${source}] ${message}`);
  }
}
