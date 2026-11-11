import { WebGL2PrimaryCommandBuffer } from "../gfx/webgl2-primary-command-buffer.ts";
import { WebGL2Device } from "../gfx/webgl2-device.ts";
import { ForwardStage, type DrawInfo } from "./forward/forward-stage.ts";

export class RenderPipeline {
  private readonly commandBuffer: WebGL2PrimaryCommandBuffer;
  private readonly forwardStage: ForwardStage;

  constructor(private readonly device: WebGL2Device) {
    this.commandBuffer = new WebGL2PrimaryCommandBuffer(device);
    this.forwardStage = new ForwardStage(this.commandBuffer);
  }

  render(cameras: readonly DrawInfo[]): void {
    this.commandBuffer.begin();
    for (const cameraDraw of cameras) this.forwardStage.render(cameraDraw);
    this.commandBuffer.end();
    this.device.queue.submit([this.commandBuffer]);
  }
}
