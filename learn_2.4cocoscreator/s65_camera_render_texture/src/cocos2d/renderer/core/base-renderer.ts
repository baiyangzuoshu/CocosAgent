import type { View } from "../../core/camera/CCCamera.ts";
import { Device } from "../gfx/device.ts";

export class BaseRenderer {
  constructor(private readonly device: Device) {}

  render(view: View): void {
    this.device.setFrameBuffer(view.framebuffer);
    this.device.drawScene();
  }
}
