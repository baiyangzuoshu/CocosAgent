import { WebGL2Queue } from "./webgl2-queue.ts";

export class WebGL2Device {
  readonly queue = new WebGL2Queue();

  readonly gl = {
    drawElements: (indexCount: number): void => {
      console.log("WebGL2 gl.drawElements(TRIANGLES,", indexCount, ")");
    },
  }

  present(): void {
    console.log("Device.present");
  }
}
