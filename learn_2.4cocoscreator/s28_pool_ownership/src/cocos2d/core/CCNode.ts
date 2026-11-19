import BaseNode from "./utils/base-node.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Node extends BaseNode {
  _instantiate(): Node {
    const clone = new Node(this.name);
    for (const component of this._components) {
      clone._components.push(component._instantiate(clone));
    }
    for (const child of this.children) {
      clone.addChild((child as Node)._instantiate());
    }
    return clone;
  }

}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;

if (!host.cc) {
  throw new Error("cc must be initialized before CCNode");
}

host.cc.Node = Node;
