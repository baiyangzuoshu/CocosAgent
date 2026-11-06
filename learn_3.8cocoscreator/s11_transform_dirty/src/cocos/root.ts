import type { Scene } from "./scene-graph/scene.ts";
import { RenderPipeline, type RenderCamera } from "./rendering/render-pipeline.ts";

export class Root {
  private readonly _pipeline = new RenderPipeline();
  private readonly _cameraList: RenderCamera[] = [];

  get lastRenderedSceneName(): string {
    return this._pipeline.lastRenderedSceneName;
  }

  setScene(scene: Scene): void {
    // 省略 Window：用一个相机代表本课唯一的浏览器视图。
    this._cameraList.splice(0, this._cameraList.length, { scene });
  }

  frameMove(_deltaTime: number): void {
    this._frameMoveEnd();
  }

  private _frameMoveEnd(): void {
    this._pipeline.render(this._cameraList);
  }
}
