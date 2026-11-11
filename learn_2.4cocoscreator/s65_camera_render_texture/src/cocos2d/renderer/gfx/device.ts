import type { FrameBuffer } from "../../core/assets/CCRenderTexture.ts";

export class Device {
  setFrameBuffer(framebuffer: FrameBuffer | null): void {
    console.log("Device.setFrameBuffer", framebuffer?.name ?? "screen framebuffer");
  }

  drawScene(): void {
    console.log("WebGL draw the camera scene");
  }

  sampleTexture(texture: string): void {
    console.log("Sprite samples", texture);
  }
}
