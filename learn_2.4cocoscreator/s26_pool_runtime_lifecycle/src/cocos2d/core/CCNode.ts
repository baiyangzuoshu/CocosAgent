import { NodeEvent } from "./event/event.ts";
import BaseNode from "./utils/base-node.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Node extends BaseNode {
  private readonly _captureListeners: Array<(event: NodeEvent) => void> = [];
  private readonly _bubbleListeners: Array<(event: NodeEvent) => void> = [];

  onTouchStart(callback: (event: NodeEvent) => void, capture = false): void {
    (capture ? this._captureListeners : this._bubbleListeners).push(callback);
  }

  dispatchTouchStart(x: number, y: number): void { this.dispatchEvent(new NodeEvent(this, x, y)); }

  override cleanup(): void {
    this._captureListeners.length = 0;
    this._bubbleListeners.length = 0;
    for (const child of this._children) child.cleanup();
  }

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
