import { RenderTexture, type FrameBuffer } from "../assets/CCRenderTexture.ts";

export interface View {
  readonly framebuffer: FrameBuffer | null;
}

export class Camera {
  private _targetTexture: RenderTexture | null = null;
  private _framebuffer: FrameBuffer | null = null;

  set targetTexture(value: RenderTexture | null) {
    this._targetTexture = value;
    this._updateTargetTexture();
  }

  private _updateTargetTexture(): void {
    this._framebuffer = this._targetTexture?.framebuffer ?? null;
    console.log("Camera._updateTargetTexture -> setFrameBuffer", this._framebuffer?.name ?? "screen");
  }

  extractView(): View {
    return { framebuffer: this._framebuffer };
  }
}
