import type CCWidget from "../components/CCWidget.ts";
import type CCNode from "../CCNode.ts";
import type { Size } from "../CCNode.ts";

export default class CCWidgetManager {
  private readonly widgets: CCWidget[] = [];

  add(widget: CCWidget): void {
    this.widgets.push(widget);
  }

  onWindowResize(target: CCNode, size: Size): void {
    target.setContentSize(size);
    target.setPosition(size.width / 2, size.height / 2);
    for (const widget of this.widgets) {
      if (widget.node.parent === target && widget.alignMode === "ON_WINDOW_RESIZE") {
        widget.dirty = true;
      }
    }
  }

  afterUpdate(): void {
    for (const widget of this.widgets) {
      if (widget.dirty) widget.align();
    }
  }

  updateAlignment(widget: CCWidget): void {
    widget.align();
  }
}
