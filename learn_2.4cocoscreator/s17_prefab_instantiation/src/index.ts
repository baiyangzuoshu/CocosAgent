import type Node from "./cocos2d/core/CCNode.ts";

export interface CocosNamespace {
  Node?: typeof Node;
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const _global = window as CocosWindow;
const cc = _global.cc ?? {};

_global.cc = cc;

// This detached-object lesson only needs the namespace before Node registration.
await import("./cocos2d/core/CCNode.ts");

export default cc;
