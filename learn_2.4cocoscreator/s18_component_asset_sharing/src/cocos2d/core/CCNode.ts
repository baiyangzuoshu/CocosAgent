import BaseNode from "./utils/base-node.ts";
import { instantiate } from "./platform/instantiate.ts";
import type { CocosNamespace } from "../../index.ts";

/** Node delegates graph cloning to the same generic path used by Prefab. */
export default class Node extends BaseNode {
  _instantiate(): Node {
    const clone = instantiate._clone(this, this);
    clone._parent = null;
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
