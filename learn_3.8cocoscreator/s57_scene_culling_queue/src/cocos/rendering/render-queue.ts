import type { RenderPass } from "../render-scene/scene/model.ts";

interface QueuedPass extends RenderPass {
  modelName: string;
  priority: number;
}

export class RenderQueue {
  private readonly _passes: QueuedPass[] = [];

  constructor(private readonly _transparent: boolean) {}

  insert(modelName: string, modelPriority: number, pass: RenderPass): void {
    if (pass.phase !== "forward" || pass.transparent !== this._transparent) return;
    this._passes.push({ ...pass, modelName, priority: modelPriority });
  }

  sort(): void {
    if (this._transparent) {
      this._passes.sort((a, b) => a.priority - b.priority || a.hash - b.hash
        || b.depth - a.depth || a.shaderId - b.shaderId);
    } else {
      this._passes.sort((a, b) => a.hash - b.hash || a.depth - b.depth || a.shaderId - b.shaderId);
    }
  }

  names(): string[] {
    return this._passes.map((pass) => pass.modelName);
  }
}
