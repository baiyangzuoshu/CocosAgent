import { RendererCamera } from "../../renderer/scene/camera.ts";
import type { RenderScene } from "../../renderer/scene/scene.ts";

export class CameraComponent {
  constructor(
    name: string,
    scene: RenderScene,
    cullingMask: number,
    stages: readonly string[],
  ) {
    const camera = new RendererCamera(name, cullingMask, stages);
    scene.cameras.push(camera);
    console.log(`CameraComponent -> renderer.scene.addCamera(${name})`);
  }
}
