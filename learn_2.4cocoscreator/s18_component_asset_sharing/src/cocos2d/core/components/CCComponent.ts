import CCObject from "../platform/CCObject.ts";
import type BaseNode from "../utils/base-node.ts";
import type { CocosNamespace } from "../../../index.ts";

/** Component data copied per Prefab instance; scheduling belongs to lesson 19. */
export default class Component extends CCObject {
  node!: BaseNode;

  _instantiate(node: BaseNode): Component {
    const Constructor = this.constructor as new () => Component;
    const clone = new Constructor();
    const source = this as unknown as Record<string, unknown>;
    const target = clone as unknown as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      if (key !== "node") target[key] = source[key];
    }
    clone.node = node;
    return clone;
  }
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;
if (!host.cc) throw new Error("cc must be initialized before CCComponent");
host.cc.Component = Component;
