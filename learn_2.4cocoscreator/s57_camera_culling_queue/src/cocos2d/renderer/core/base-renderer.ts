import type { View } from "./view.ts";
import type { Model } from "../scene/model.ts";
import type { RenderScene } from "../scene/scene.ts";

export abstract class BaseRenderer {
  renderView(view: View, scene: RenderScene): void {
    console.log(`BaseRenderer._render(${view.cameraName})`);
    const models = scene.models.filter((model) => (model.cullingMask & view.cullingMask) !== 0);
    console.log(`  cullingMask keeps: ${models.map((model) => model.name).join(", ") || "none"}`);

    for (const stage of view.stages) {
      const stageModels = models.filter((model) => model.stages.includes(stage));
      this.renderStage(stage, stageModels);
    }
  }

  protected abstract renderStage(stage: string, models: Model[]): void;
}
