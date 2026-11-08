import type { Context } from './types.ts';

export class Fiber {
  private disposed = false;

  constructor(
    readonly name: string,
    private readonly ctx: Context,
  ) {}

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    console.log(`[fiber] unloading ${this.name}`);
    await this.ctx.disposeEffects();
    console.log(`[fiber] unloaded ${this.name}`);
  }
}
