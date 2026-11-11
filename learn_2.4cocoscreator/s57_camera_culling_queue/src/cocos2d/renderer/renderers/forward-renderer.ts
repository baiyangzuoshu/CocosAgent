import { BaseRenderer } from "../core/base-renderer.ts";
import type { Model } from "../scene/model.ts";
import type { RenderScene } from "../scene/scene.ts";

export class ForwardRenderer extends BaseRenderer {
  renderCamera(scene: RenderScene, camera: { extractView(): { cameraName: string; cullingMask: number; stages: readonly string[] } }): void {
    const view = camera.extractView();
    this.renderView(view, scene);
  }

  protected renderStage(stage: string, models: Model[]): void {
    const ordered = stage === "transparent"
      ? [...models].sort((a, b) => b.cameraDepth - a.cameraDepth)
      : models;
    console.log(`  ${stage}: ${ordered.map((model) => model.name).join(" -> ") || "empty"}`);
  }
}
