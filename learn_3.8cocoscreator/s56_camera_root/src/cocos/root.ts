import { Camera } from "./render-scene/scene/camera.ts";
import type { RenderWindow } from "./render-scene/core/render-window.ts";
import { RenderPipeline } from "./rendering/render-pipeline.ts";

export class Root {
  private readonly _cameraList: Camera[] = [];
  private readonly _pipeline = new RenderPipeline();

  createCamera(): Camera {
    console.log("Root.createCamera() -> camera pool");
    return new Camera();
  }

  frameMove(windows: RenderWindow[]): void {
    this._cameraList.length = 0;
    for (const window of windows) window.extractRenderCameras(this._cameraList);
    this._cameraList.sort((a, b) => a.priority - b.priority);
    console.log(`Root sorts cameras: ${this._cameraList.map((camera) => camera.name).join(" -> ")}`);
    this._pipeline.render(this._cameraList);
    console.log("Root.device.present()");
  }
}
