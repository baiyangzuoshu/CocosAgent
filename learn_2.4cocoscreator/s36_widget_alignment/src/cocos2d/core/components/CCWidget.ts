import type CCWidgetManager from "../base-ui/CCWidgetManager.ts";
import type CCNode from "../CCNode.ts";

export type AlignMode = "ONCE" | "ON_WINDOW_RESIZE" | "ALWAYS";

export default class CCWidget {
  readonly alignMode: AlignMode = "ON_WINDOW_RESIZE";
  dirty = true;
  right = 24;

  constructor(
    readonly node: CCNode,
    private readonly manager: CCWidgetManager,
  ) {}

  align(): void {
    const target = this.node.parent;
    if (!target) return;

    const left = -target.anchorPoint.x * target.contentSize.width;
    const rightEdge = left + target.contentSize.width - this.right;
    const x = rightEdge + (this.node.anchorPoint.x - 1) * this.node.contentSize.width;
    const centerY = (0.5 - target.anchorPoint.y) * target.contentSize.height;
    const y = centerY + (this.node.anchorPoint.y - 0.5) * this.node.contentSize.height;
    this.node.setPosition(x, y);
    this.dirty = false;
  }

  updateAlignment(): void {
    this.manager.updateAlignment(this);
  }
}
