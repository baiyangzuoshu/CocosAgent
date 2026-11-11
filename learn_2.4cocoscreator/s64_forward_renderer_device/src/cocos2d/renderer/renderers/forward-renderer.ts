import { BaseRenderer, type DrawItem } from "../core/base-renderer.ts";

export class ForwardRenderer extends BaseRenderer {
  renderOpaque(items: readonly DrawItem[]): void {
    console.log("ForwardRenderer._opaqueStage");
    for (const item of items) this._draw(item);
  }
}
