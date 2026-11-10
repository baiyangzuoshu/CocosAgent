import type { RenderCamera } from "./render-pipeline.ts";
import type { Batcher2D } from "../2d/renderer/batcher-2d.ts";
import type { Node } from "../scene-graph/node.ts";

export class RenderFlow {
  private _lastRenderedSceneName = "等待相机";

  get lastRenderedSceneName(): string {
    return this._lastRenderedSceneName;
  }

  render(camera: RenderCamera, batcher: Batcher2D): void {
    this._lastRenderedSceneName = camera.scene.name;
    this._visit(camera.scene, batcher);
  }

  private _visit(node: Node, batcher: Batcher2D): void {
    if (!node.activeInHierarchy) return;
    node.worldPosition;
    const component = node._renderComponent;
    if (component) {
      component.updateRenderData();
      component.fillBuffers(batcher);
    }
    for (const child of node.children) this._visit(child, batcher);
  }
}
