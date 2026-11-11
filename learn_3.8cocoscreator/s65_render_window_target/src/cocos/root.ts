import { RenderPipeline } from "./rendering/render-pipeline.ts";
import type { CameraComponent } from "./misc/camera-component.ts";

export class Root {
  constructor(private readonly pipeline: RenderPipeline) {}

  render(camera: CameraComponent): void {
    this.pipeline.render(camera);
    console.log("Root.device.present");
  }
}
