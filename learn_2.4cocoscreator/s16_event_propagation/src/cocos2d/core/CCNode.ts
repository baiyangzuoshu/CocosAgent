import { NodeEvent } from "./event/event.ts";
import BaseNode from "./utils/base-node.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Node extends BaseNode {
  private readonly _captureListeners: Array<(event: NodeEvent) => void> = [];
  private readonly _bubbleListeners: Array<(event: NodeEvent) => void> = [];
  private _position = { x: 0, y: 0 };

  onTouchStart(callback: (event: NodeEvent) => void, capture = false): void {
    (capture ? this._captureListeners : this._bubbleListeners).push(callback);
  }

  _hitTest(x: number, y: number): boolean {
    const pos = this.getWorldPosition();
    return this.activeInHierarchy && Math.abs(x - pos.x) <= 28 && Math.abs(y - pos.y) <= 28;
  }

  dispatchTouchStart(x: number, y: number): void { this.dispatchEvent(new NodeEvent(this, x, y)); }

  dispatchEvent(event: NodeEvent): void {
    const parents: Node[] = [];
    for (let node = this.getParent() as Node | null; node; node = node.getParent() as Node | null) parents.push(node);
    event.phase = "capture";
    for (const node of [...parents].reverse()) {
      event.currentTarget = node;
      for (const callback of node._captureListeners) callback(event);
      if (event.propagationStopped) return;
    }
    event.phase = "target";
    event.currentTarget = this;
    for (const callback of this._captureListeners) callback(event);
    for (const callback of this._bubbleListeners) callback(event);
    if (!event.bubbles || event.propagationStopped) return;
    event.phase = "bubble";
    for (const node of parents) {
      event.currentTarget = node;
      for (const callback of node._bubbleListeners) callback(event);
      if (event.propagationStopped) return;
    }
  }

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
