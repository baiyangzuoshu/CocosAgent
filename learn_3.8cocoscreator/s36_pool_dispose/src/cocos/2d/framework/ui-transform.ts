import type { Node } from "../../scene-graph/node.ts";

export class UITransform {
  constructor(private readonly node: Node, readonly width = 56, readonly height = 56) {}
  hitTest(x: number, y: number): boolean {
    const pos = this.node.worldPosition;
    return this.node.activeInHierarchy && Math.abs(x - pos.x) <= this.width / 2 && Math.abs(y - pos.y) <= this.height / 2;
  }
}
