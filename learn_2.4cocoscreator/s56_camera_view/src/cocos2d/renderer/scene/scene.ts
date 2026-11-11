import type { RendererCamera } from "./camera.ts";

export class RenderScene {
  readonly _cameras: RendererCamera[] = [];

  addCamera(camera: RendererCamera): void {
    this._cameras.push(camera);
    console.log(`renderer.scene.addCamera(${camera.name})`);
  }
}
