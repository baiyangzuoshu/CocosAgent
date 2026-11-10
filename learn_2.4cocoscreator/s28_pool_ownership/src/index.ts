import type EventTarget from "./cocos2d/core/event/event-target.ts";
import type CCObject from "./cocos2d/core/platform/CCObject.ts";
import type BaseNode from "./cocos2d/core/utils/base-node.ts";
import type Director from "./cocos2d/core/CCDirector.ts";
import type { GameObject } from "./cocos2d/core/CCGame.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import type Component from "./cocos2d/core/components/CCComponent.ts";
import type Scene from "./cocos2d/core/CCScene.ts";

/**
 * Course counterpart of engine/2.4.15engine/index.js.
 * Create the shared namespace before loading engine modules.
 */
export interface CocosNamespace {
  internal?: Record<string, unknown>;
  Object?: typeof CCObject;
  _BaseNode?: typeof BaseNode;
  macro?: {
    RAD: number;
    DEG: number;
  };
  EventTarget?: typeof EventTarget;
  Director?: typeof Director;
  director?: Director;
  game?: GameObject;
  Node?: typeof Node;
  Component?: typeof Component;
  Scene?: typeof Scene;
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
await import("./cocos2d/index.ts");

export default cc;
