import type { Camera } from "../render-scene/scene/camera.ts";

export class RenderPipeline {
  render(cameras: Camera[]): void {
    console.log("RenderPipeline.begin command buffer");
    for (const camera of cameras) {
      if (!camera.scene) continue;
      console.log(`sceneCulling + camera UBO + flows (${camera.name})`);
    }
    console.log("RenderPipeline.end -> device.queue.submit(commandBuffers)");
  }
}
