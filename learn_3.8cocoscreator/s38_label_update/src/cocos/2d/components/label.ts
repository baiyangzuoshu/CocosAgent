import UIRendererManager from "../framework/ui-renderer-manager.ts";
import LabelAssembler from "../renderer/label-assembler.ts";

export default class Label {
  private _string = "";
  readonly renderData = { text: "", width: 0, vertDirty: true };

  constructor(
    private readonly _manager: UIRendererManager,
    private readonly _assembler: LabelAssembler,
  ) {}

  get string(): string { return this._string; }

  set string(value: string) {
    const next = value == null ? "" : value.toString();
    if (this._string === next) return;
    this._string = next;
    this._markForUpdateRenderData();
  }

  private _markForUpdateRenderData(): void {
    this.renderData.vertDirty = true;
    this._manager.markDirtyRenderer(this);
  }

  updateRenderData(): void {
    this._assembler.updateRenderData(this);
  }
}
