import { ForwardStage } from "./forward/forward-stage.ts";
import { sceneCulling } from "./scene-culling.ts";
import type { Camera } from "../render-scene/scene/camera.ts";
import type { Model } from "../render-scene/scene/model.ts";

export class RenderPipeline {
  private readonly _forwardStage = new ForwardStage();

  render(camera: Camera, models: Model[]): void {
    const renderObjects = sceneCulling(camera, models);
    this._forwardStage.render(renderObjects);
  }
}
