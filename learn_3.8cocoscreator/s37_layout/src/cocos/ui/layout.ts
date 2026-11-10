import type Director from "../game/director.ts";
import type Node from "../scene-graph/node.ts";
import type UITransform from "../2d/framework/ui-transform.ts";

export default class Layout {
  readonly type = "HORIZONTAL";
  readonly resizeMode = "CONTAINER";
  readonly paddingLeft = 16;
  readonly paddingRight = 16;
  readonly spacingX = 12;
  private layoutDirty = true;
  private childrenDirty = true;
  private usefulLayoutObjects: UITransform[] = [];

  constructor(readonly node: Node, director: Director) {
    node.onChildAdded(() => {
      this.childrenDirty = true;
      this.layoutDirty = true;
    });
    director.onAfterUpdate(() => this.updateLayout());
  }

  updateLayout(force = false): void {
    if (!this.layoutDirty && !force) return;
    if (this.childrenDirty) {
      this.usefulLayoutObjects = this.node.children
        .filter((child) => child.activeInHierarchy)
        .map((child) => child.uiTransform);
      this.childrenDirty = false;
    }
    if (this.usefulLayoutObjects.length === 0) return;

    const childrenWidth = this.usefulLayoutObjects.reduce(
      (sum, child) => sum + child.contentSize.width,
      0,
    );
    const width = childrenWidth
      + (this.usefulLayoutObjects.length - 1) * this.spacingX
      + this.paddingLeft
      + this.paddingRight;
    this.node.uiTransform.contentSize.width = width;

    let cursor = -this.node.uiTransform.anchorPoint.x * width + this.paddingLeft;
    for (const child of this.usefulLayoutObjects) {
      const node = this.node.children.find((item) => item.uiTransform === child);
      if (!node) continue;
      node.position.x = cursor + child.anchorPoint.x * child.contentSize.width;
      cursor += child.contentSize.width + this.spacingX;
    }
    this.layoutDirty = false;
  }

  isDirty(): boolean {
    return this.layoutDirty;
  }
}
