import BaseNode from "./utils/base-node.ts";
import type { CocosNamespace } from "../../index.ts";

/** 第 17 课只保留节点名、本地位置与子节点复制；事件分发与渲染状态不在本课范围内。 */
export default class Node extends BaseNode {
  private _position = { x: 0, y: 0 };

  setPosition(x: number, y: number): void {
    this._position.x = x;
    this._position.y = y;
  }

  getPosition(): { x: number; y: number } {
    return { ...this._position };
  }

  _instantiate(): Node {
    const clone = new Node(this.name);
    clone.setPosition(this._position.x, this._position.y);
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
