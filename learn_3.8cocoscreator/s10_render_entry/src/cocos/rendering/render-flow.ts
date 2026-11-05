import type { RenderCamera } from "./render-pipeline.ts";

export class RenderFlow {
  private _lastRenderedSceneName = "等待相机";

  get lastRenderedSceneName(): string {
    return this._lastRenderedSceneName;
  }

  render(camera: RenderCamera): void {
    this._lastRenderedSceneName = camera.scene.name;
  }
}
