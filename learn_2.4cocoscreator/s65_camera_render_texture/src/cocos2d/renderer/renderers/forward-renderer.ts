import { Camera } from "../../core/camera/CCCamera.ts";
import { BaseRenderer } from "../core/base-renderer.ts";

export class ForwardRenderer {
  constructor(private readonly baseRenderer: BaseRenderer) {}

  renderCamera(camera: Camera): void {
    console.log("ForwardRenderer.renderCamera -> extract View");
    this.baseRenderer.render(camera.extractView());
  }
}
