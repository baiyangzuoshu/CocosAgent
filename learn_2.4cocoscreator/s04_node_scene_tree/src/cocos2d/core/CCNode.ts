import BaseNode from "./utils/base-node.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Node extends BaseNode {}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;

if (!host.cc) {
  throw new Error("cc must be initialized before CCNode");
}

host.cc.Node = Node;
