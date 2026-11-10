import type CCNode from "../CCNode.ts";
import type CCDirector from "../CCDirector.ts";

export default class CCLayout {
  readonly type = "HORIZONTAL";
  readonly resizeMode = "CONTAINER";
  readonly paddingLeft = 16;
  readonly paddingRight = 16;
  readonly spacingX = 12;
  private layoutDirty = true;

  constructor(readonly node: CCNode, director: CCDirector) {
    node.onChildAdded(() => {
      this.layoutDirty = true;
    });
    director.onAfterUpdate(() => this.updateLayout());
  }

  updateLayout(): void {
    const children = this.node.children.filter((child) => child.activeInHierarchy);
    if (!this.layoutDirty || children.length === 0) return;

    const childrenWidth = children.reduce(
      (sum, child) => sum + child.contentSize.width,
      0,
    );
    const width = childrenWidth
      + (children.length - 1) * this.spacingX
      + this.paddingLeft
      + this.paddingRight;
    this.node.contentSize.width = width;

    let cursor = -this.node.anchorPoint.x * width + this.paddingLeft;
    for (const child of children) {
      child.setPosition(
        cursor + child.anchorPoint.x * child.contentSize.width,
        child.position.y,
      );
      cursor += child.contentSize.width + this.spacingX;
    }
    this.layoutDirty = false;
  }

  isDirty(): boolean {
    return this.layoutDirty;
  }
}
