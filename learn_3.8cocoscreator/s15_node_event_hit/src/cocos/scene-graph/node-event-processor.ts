import type { Node } from "./node.ts";
import { UITransform } from "../2d/framework/ui-transform.ts";

export class NodeEventProcessor {
  private readonly _uiTransform: UITransform;
  constructor(private readonly node: Node) { this._uiTransform = new UITransform(node); }
  handleTouchStart(x: number, y: number): boolean {
    if (!this._uiTransform.hitTest(x, y)) return false;
    this.node.dispatchTouchStart(x, y);
    return true;
  }
}
