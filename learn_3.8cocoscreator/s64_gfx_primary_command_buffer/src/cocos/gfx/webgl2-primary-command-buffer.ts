import type { DrawInfo } from "../rendering/forward/forward-stage.ts";
import { WebGL2Device } from "./webgl2-device.ts";
import { WebGL2CmdFuncDraw } from "./webgl2-commands.ts";

export class WebGL2PrimaryCommandBuffer {
  private inRenderPass = false;
  drawCalls = 0;

  constructor(private readonly device: WebGL2Device) {}

  begin(): void {
    this.drawCalls = 0;
    console.log("CommandBuffer.begin");
  }

  beginRenderPass(): void {
    this.inRenderPass = true;
    console.log("CommandBuffer.beginRenderPass");
  }

  draw(info: DrawInfo): void {
    if (!this.inRenderPass) throw new Error("draw must be inside a render pass");
    console.log("PrimaryCommandBuffer.draw applies pipeline and IA state");
    WebGL2CmdFuncDraw(this.device, info.indexCount);
    this.drawCalls++;
  }

  endRenderPass(): void {
    this.inRenderPass = false;
    console.log("CommandBuffer.endRenderPass");
  }

  end(): void {
    console.log("CommandBuffer.end");
  }
}
