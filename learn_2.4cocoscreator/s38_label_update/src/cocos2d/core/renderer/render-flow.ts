import type CCLabel from "../components/CCLabel.ts";

export default class RenderFlow {
  private readonly _dirtyLabels = new Set<CCLabel>();

  markForUpdate(label: CCLabel): void {
    this._dirtyLabels.add(label);
  }

  render(): void {
    for (const label of this._dirtyLabels) label.updateRenderData();
    this._dirtyLabels.clear();
  }
}
