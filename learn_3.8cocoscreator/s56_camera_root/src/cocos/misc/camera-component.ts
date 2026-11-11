import type { Root } from "../root.ts";
import type { Camera } from "../render-scene/scene/camera.ts";
import type { RenderScene } from "../render-scene/core/render-scene.ts";
import type { RenderWindow } from "../render-scene/core/render-window.ts";

export class CameraComponent {
  private readonly _camera: Camera;

  constructor(
    private readonly _root: Root,
    private readonly _scene: RenderScene,
    window: RenderWindow,
    name: string,
    priority: number,
    rect: { x: number; y: number; width: number; height: number },
  ) {
    this._camera = this._root.createCamera();
    this._camera.initialize({ name, node: name, projection: "perspective", window, priority });
    this._camera.setViewportInOrientedSpace(rect);
    this._camera.update();
  }

  onEnable(): void {
    this._scene.addCamera(this._camera);
  }
}
