import { RenderFlow } from "./render-flow.ts";
import type { Scene } from "../scene-graph/scene.ts";

export interface RenderCamera {
  scene: Scene;
}

export class RenderPipeline {
  private readonly _flows = [new RenderFlow()];

  get lastRenderedSceneName(): string {
    return this._flows[0].lastRenderedSceneName;
  }

  render(cameras: readonly RenderCamera[]): void {
    for (const camera of cameras) {
      if (camera.scene) this._flows[0].render(camera);
    }
  }
}
