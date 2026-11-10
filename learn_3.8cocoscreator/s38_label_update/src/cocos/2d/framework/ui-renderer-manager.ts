import type Label from "../components/label.ts";

export default class UIRendererManager {
  private readonly _dirtyRenderers = new Set<Label>();

  markDirtyRenderer(label: Label): void {
    this._dirtyRenderers.add(label);
  }

  update(): void {
    for (const renderer of this._dirtyRenderers) renderer.updateRenderData();
    this._dirtyRenderers.clear();
  }
}
