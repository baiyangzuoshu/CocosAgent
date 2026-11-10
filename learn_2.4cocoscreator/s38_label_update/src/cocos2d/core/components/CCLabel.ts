import RenderFlow from "../renderer/render-flow.ts";
import LabelAssembler from "../renderer/label-assembler.ts";

export default class CCLabel {
  private _string = "";
  readonly renderData = { text: "", width: 0, dirty: true };

  constructor(
    private readonly _renderFlow: RenderFlow,
    private readonly _assembler: LabelAssembler,
  ) {}

  get string(): string { return this._string; }

  set string(value: string) {
    const oldValue = this._string;
    this._string = "" + value;
    if (this._string !== oldValue) this.setVertsDirty();
  }

  setVertsDirty(): void {
    this.renderData.dirty = true;
    this._renderFlow.markForUpdate(this);
  }

  updateRenderData(): void {
    this._assembler.updateRenderData(this);
  }
}
