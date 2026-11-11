import type { Camera } from "../scene/camera.ts";

export class RenderWindow {
  private readonly _cameras: Camera[] = [];

  attachCamera(camera: Camera): void {
    this._cameras.push(camera);
    console.log(`RenderWindow.attachCamera(${camera.name})`);
  }

  extractRenderCameras(out: Camera[]): void {
    for (const camera of this._cameras) {
      if (!camera.enabled) continue;
      camera.update();
      out.push(camera);
    }
  }
}
