import { RenderFlow } from "./render-flow.ts";
import type { Scene } from "../scene-graph/scene.ts";
import { Batcher2D } from "../2d/renderer/batcher-2d.ts";

export interface RenderCamera {
  scene: Scene;
}

export class RenderPipeline {
  private readonly _flows = [new RenderFlow()];
  private readonly _batcher: Batcher2D;

  constructor(canvas: HTMLCanvasElement) {
    this._batcher = new Batcher2D(canvas);
  }

  get lastRenderedSceneName(): string {
    return this._flows[0].lastRenderedSceneName;
  }

  get drawCallCount(): number {
    return this._batcher.drawCallCount;
  }

  render(cameras: readonly RenderCamera[]): void {
    this._batcher.beginFrame();
    for (const camera of cameras) {
      if (camera.scene) this._flows[0].render(camera, this._batcher);
    }
    this._batcher.endFrame();
  }
}
