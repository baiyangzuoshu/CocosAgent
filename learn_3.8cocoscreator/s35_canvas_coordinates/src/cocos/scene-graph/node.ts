import UITransform from "../2d/framework/ui-transform.ts";
import type { Point } from "../ui/view.ts";

export default class Node {
  position: Point = { x: 0, y: 0 };
  readonly uiTransform = new UITransform();

  constructor(readonly name: string) {}

  setPosition(x: number, y: number): void {
    this.position = { x, y };
  }
}
