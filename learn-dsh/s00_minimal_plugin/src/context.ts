import type { Context } from './types.ts';

export function createContext(): Context {
  return {
    log(source, message) {
      console.log(`[${source}] ${message}`);
    },
  };
}
