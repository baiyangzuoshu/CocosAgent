import type { Camera } from "../scene/camera.ts";

export class RenderScene {
  readonly cameras: Camera[] = [];

  addCamera(camera: Camera): void {
    camera.attachToScene(this);
    this.cameras.push(camera);
    console.log(`RenderScene.addCamera(${camera.name})`);
  }
}
