import type { Model } from "./model.ts";
import type { RendererCamera } from "./camera.ts";

export class RenderScene {
  readonly models: Model[] = [];
  readonly cameras: RendererCamera[] = [];
}
