import type { View } from "../core/view.ts";

export class RendererCamera {
  priority = 0;
  rect = { x: 0, y: 0, w: 1, h: 1 };
  cullingMask = 0xffffffff;
  targetTexture: string | null = null;

  constructor(public readonly name: string) {}

  extractView(out: View, width: number, height: number): void {
    out.cameraName = this.name;
    out.priority = this.priority;
    out.rect = {
      x: this.rect.x * width,
      y: this.rect.y * height,
      w: this.rect.w * width,
      h: this.rect.h * height,
    };
    console.log(`${this.name}.extractView -> pixel rect ${out.rect.w}x${out.rect.h}`);
  }
}
