import type Scene from "../CCScene.ts";

export class RenderFlow {
  private _lastRenderedSceneName = "等待场景";

  get lastRenderedSceneName(): string {
    return this._lastRenderedSceneName;
  }

  render(scene: Scene, _deltaTime: number): void {
    // 本课只保留 Renderer 到 RenderFlow 的入口，节点遍历留到下一课。
    this._lastRenderedSceneName = scene.name;
  }
}
