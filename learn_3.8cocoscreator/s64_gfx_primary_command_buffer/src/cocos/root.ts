import { RenderPipeline } from "./rendering/render-pipeline.ts";
import type { DrawInfo } from "./rendering/forward/forward-stage.ts";
import { WebGL2Device } from "./gfx/webgl2-device.ts";

export class Root {
  constructor(private readonly pipeline: RenderPipeline, private readonly device: WebGL2Device) {}

  frameMoveEnd(cameras: readonly DrawInfo[]): void {
    console.log("Root._frameMoveEnd: sort cameras");
    if (cameras.length === 0) return;
    this.pipeline.render(cameras);
    this.device.present();
  }
}
