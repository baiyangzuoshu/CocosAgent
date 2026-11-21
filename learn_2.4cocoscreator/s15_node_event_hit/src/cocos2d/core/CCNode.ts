import BaseNode from "./utils/base-node.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Node extends BaseNode {
  private _touchStart: ((x: number, y: number) => void) | null = null;
  private _position = { x: 0, y: 0 };

  onTouchStart(callback: (x: number, y: number) => void): void { this._touchStart = callback; }

  _hitTest(x: number, y: number): boolean {
    const pos = this.getWorldPosition();
    return this.activeInHierarchy && Math.abs(x - pos.x) <= 28 && Math.abs(y - pos.y) <= 28;
  }

  dispatchTouchStart(x: number, y: number): void { this._touchStart?.(x, y); }

  setPosition(x: number, y: number): void {
    this._position.x = x;
    this._position.y = y;
  }

  getWorldPosition(): { x: number; y: number } {
    const parent = this.getParent() as Node | null;
    const parentPosition = parent?.getWorldPosition() ?? { x: 0, y: 0 };
    return { x: parentPosition.x + this._position.x, y: parentPosition.y + this._position.y };
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
