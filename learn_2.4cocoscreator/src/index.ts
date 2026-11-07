/**
 * Course counterpart of engine/2.4.15engine/index.js.
 * Create the shared namespace before loading engine modules.
 */
export interface CocosNamespace {
  internal?: Record<string, unknown>;
  macro?: {
    RAD: number;
    DEG: number;
  };
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const _global = window as CocosWindow;
const cc = _global.cc ?? {};

_global.cc = cc;
cc.internal = cc.internal ?? {};

// Dynamic import preserves the source entry's order: initialize cc, then require predefine.
await import("./cocos2d/core/predefine.ts");

export default cc;
