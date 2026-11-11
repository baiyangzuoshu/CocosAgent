import type { WebGL2PrimaryCommandBuffer } from "./webgl2-primary-command-buffer.ts";

export class WebGL2Queue {
  submit(commandBuffers: readonly WebGL2PrimaryCommandBuffer[]): void {
    const drawCalls = commandBuffers.reduce((sum, commandBuffer) => sum + commandBuffer.drawCalls, 0);
    console.log("WebGL2Queue.submit: aggregate drawCalls =", drawCalls);
  }
}
