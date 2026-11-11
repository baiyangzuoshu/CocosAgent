import type { RenderTexture, RenderWindow } from "../asset/render-texture.ts";

export class CameraComponent {
  private _targetTexture: RenderTexture | null = null;
  window: RenderWindow | null = null;

  set targetTexture(value: RenderTexture | null) {
    this._targetTexture = value;
    this.window = value?.window ?? null;
    console.log("CameraComponent.targetTexture -> Camera.changeTargetWindow", this.window?.name ?? "main-window");
    if (this.window) console.log("Camera.setFixedSize", this.window.width, this.window.height);
  }
}
