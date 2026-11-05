import type Scene from "../CCScene.ts";
import { RenderFlow } from "./render-flow.ts";

class Renderer {
  private readonly _flow = new RenderFlow();

  get lastRenderedSceneName(): string {
    return this._flow.lastRenderedSceneName;
  }

  render(scene: Scene | null, deltaTime: number): void {
    if (!scene) return;
    this._flow.render(scene, deltaTime);
  }
}

export const renderer = new Renderer();
