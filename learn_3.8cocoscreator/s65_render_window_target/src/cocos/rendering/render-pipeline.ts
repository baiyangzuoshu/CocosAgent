import type { CameraComponent } from "../misc/camera-component.ts";

export class RenderPipeline {
  render(camera: CameraComponent): void {
    const framebuffer = camera.window?.framebuffer;
    console.log("RenderPipeline.render camera ->", camera.window?.name ?? "main-window");
    console.log("ForwardStage.beginRenderPass", framebuffer?.renderPass ?? "swapchain render pass");
    console.log("draw scene into current Window framebuffer");
  }
}
