import type CCObject from "./cocos2d/core/platform/CCObject.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import type Component from "./cocos2d/core/components/CCComponent.ts";

export interface CocosNamespace {
  Object?: typeof CCObject;
  Node?: typeof Node;
  Component?: typeof Component;
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const _global = window as CocosWindow;
const cc = _global.cc ?? {};

_global.cc = cc;

// This lesson clones detached objects; it does not load Scene, Director, or start the game loop.
await import("./cocos2d/core/predefine.ts");
await import("./cocos2d/core/components/CCComponent.ts");
await import("./cocos2d/core/CCNode.ts");

export default cc;
