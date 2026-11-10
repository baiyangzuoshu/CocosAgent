import type Widget from "./widget.ts";
import type Node from "../scene-graph/node.ts";
import type { Size } from "../2d/framework/ui-transform.ts";

export default class WidgetManager {
  private readonly widgets: Widget[] = [];

  add(widget: Widget): void {
    this.widgets.push(widget);
  }

  onDesignResolutionChanged(target: Node, size: Size): void {
    target.uiTransform.setContentSize(size);
    target.setPosition(size.width / 2, size.height / 2);
    for (const widget of this.widgets) {
      if (widget.node.parent === target && widget.alignMode !== "ONCE") {
        widget.dirty = true;
      }
    }
  }

  afterUpdate(): void {
    for (const widget of this.widgets) {
      if (widget.dirty) widget.align();
    }
  }

  updateAlignment(widget: Widget): void {
    widget.align();
  }
}
