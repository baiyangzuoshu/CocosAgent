import type Node from "./cocos2d/core/CCNode.ts";
import type CCObject from "./cocos2d/core/platform/CCObject.ts";
import type Component from "./cocos2d/core/components/CCComponent.ts";

export interface CocosNamespace {
  Node?: typeof Node;
  Object?: typeof CCObject;
  Component?: typeof Component;
  director?: {
    _compScheduler?: {
      enableComp(component: Component): void;
      disableComp(component: Component): void;
    };
  };
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
