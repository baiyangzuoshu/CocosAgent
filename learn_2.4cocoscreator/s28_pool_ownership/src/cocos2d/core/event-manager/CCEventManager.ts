import type Node from "../CCNode.ts";

export class CCEventManager {
  private _listeners: Node[] = [];
  addListener(node: Node): void { this._listeners.push(node); }
  dispatchTouchStart(x: number, y: number): boolean {
    for (const node of this._listeners) {
      if (node._hitTest(x, y)) {
        node.dispatchTouchStart(x, y);
        return true;
      }
    }
    return false;
  }
}
