import type { WebGL2Device } from "./webgl2-device.ts";

export function WebGL2CmdFuncDraw(device: WebGL2Device, indexCount: number): void {
  device.gl.drawElements(indexCount);
}
