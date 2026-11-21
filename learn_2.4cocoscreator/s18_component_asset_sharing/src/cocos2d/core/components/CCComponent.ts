import CCObject from "../platform/CCObject.ts";
import type BaseNode from "../utils/base-node.ts";
import type { CocosNamespace } from "../../../index.ts";

/** Component instance data is cloned with its owning Node. */
export default class Component extends CCObject {
  node!: BaseNode;
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;
if (!host.cc) throw new Error("cc must be initialized before CCComponent");
host.cc.Component = Component;
