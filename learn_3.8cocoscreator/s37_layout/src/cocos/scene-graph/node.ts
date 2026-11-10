import UITransform from "../2d/framework/ui-transform.ts";
import type { Point } from "../2d/framework/ui-transform.ts";

export default class Node {
  readonly children: Node[] = [];
  readonly uiTransform = new UITransform();
  readonly position: Point = { x: 0, y: 0 };
  activeInHierarchy = true;
  private readonly childAddedListeners: Array<(child: Node) => void> = [];

  constructor(readonly name: string) {}

  addChild(child: Node): void {
    this.children.push(child);
    for (const listener of this.childAddedListeners) listener(child);
  }

  onChildAdded(listener: (child: Node) => void): void {
    this.childAddedListeners.push(listener);
  }
}
