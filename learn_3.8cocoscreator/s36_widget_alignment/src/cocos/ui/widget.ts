import type WidgetManager from "./widget-manager.ts";
import type Node from "../scene-graph/node.ts";

export type AlignMode = "ONCE" | "ON_WINDOW_RESIZE" | "ALWAYS";

export default class Widget {
  readonly alignMode: AlignMode = "ON_WINDOW_RESIZE";
  dirty = true;
  right = 24;

  constructor(readonly node: Node, private readonly manager: WidgetManager) {}

  align(): void {
    const target = this.node.parent;
    if (!target) return;

    const targetTransform = target.uiTransform;
    const nodeTransform = this.node.uiTransform;
    const left = -targetTransform.anchorPoint.x * targetTransform.contentSize.width;
    const rightEdge = left + targetTransform.contentSize.width - this.right;
    const x = rightEdge + (nodeTransform.anchorPoint.x - 1) * nodeTransform.contentSize.width;
    const centerY = (0.5 - targetTransform.anchorPoint.y) * targetTransform.contentSize.height;
    const y = centerY + (nodeTransform.anchorPoint.y - 0.5) * nodeTransform.contentSize.height;
    this.node.setPosition(x, y);
    this.dirty = false;
  }

  updateAlignment(): void {
    this.manager.updateAlignment(this);
  }
}
