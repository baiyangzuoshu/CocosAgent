import BaseNode from "./utils/base-node.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Node extends BaseNode {
  private _position = { x: 0, y: 0 };

  setPosition(x: number, y: number): void {
    this._position.x = x;
    this._position.y = y;
  }

  getPosition(): { x: number; y: number } {
    return { ...this._position };
  }

  getWorldPosition(): { x: number; y: number } {
    const parent = this.getParent();
    if (parent instanceof Node) {
      const parentPosition = parent.getWorldPosition();
      return {
        x: parentPosition.x + this._position.x,
        y: parentPosition.y + this._position.y,
      };
    }
    return this.getPosition();
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
