import type Scene from "../CCScene.ts";
import { RenderFlow } from "./render-flow.ts";
import ModelBatcher from "./webgl/model-batcher.ts";

class Renderer {
  private readonly _flow = new RenderFlow();
  private readonly _batcher = new ModelBatcher(document.querySelector<HTMLCanvasElement>("#game"));

  get lastRenderedSceneName(): string {
    return this._flow.lastRenderedSceneName;
  }

  get transformHistory(): readonly string[] {
    return this._flow.transformHistory;
  }

  render(scene: Scene | null, deltaTime: number): void {
    if (!scene) return;
    this._batcher.beginFrame();
    this._flow.render(scene, deltaTime, this._batcher);
    this._batcher.endFrame();
  }

  get drawCallCount(): number {
    return this._batcher.drawCallCount;
  }
}

export const renderer = new Renderer();
