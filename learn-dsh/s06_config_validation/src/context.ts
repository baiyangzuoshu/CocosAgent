import type { Context as ContextApi } from './types.ts';

export class Context implements ContextApi {
  log(source: string, message: string): void {
    console.log(`[${source}] ${message}`);
  }
}
