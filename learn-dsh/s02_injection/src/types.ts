import type { Context } from './context.ts';

export interface Plugin {
  readonly name: string;
  readonly inject?: readonly string[];
  apply(ctx: Context): void | Promise<void>;
}
