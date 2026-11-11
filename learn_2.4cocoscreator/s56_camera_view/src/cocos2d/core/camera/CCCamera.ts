import { RendererCamera } from "../../renderer/scene/camera.ts";
import type { RenderScene } from "../../renderer/scene/scene.ts";

export class CameraComponent {
  readonly _camera: RendererCamera;

  constructor(
    name: string,
    private readonly _scene: RenderScene,
    depth: number,
    rect: { x: number; y: number; width: number; height: number },
  ) {
    this._camera = new RendererCamera(name);
    this._camera.priority = depth;
    this._camera.rect = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    console.log(`CameraComponent._init(${name}) -> set priority, rect, culling mask, target texture`);
  }

  onEnable(): void {
    this._scene.addCamera(this._camera);
  }
}
