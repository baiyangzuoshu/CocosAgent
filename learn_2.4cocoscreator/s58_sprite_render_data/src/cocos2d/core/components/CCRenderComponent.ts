import { Assembler, type SpriteAssembler, type SpriteNode } from "../renderer/assembler.ts";
import { RenderData } from "../renderer/render-data.ts";

export const UPDATE_RENDER_DATA = 1 << 0;

export class CCRenderComponent {
  readonly node: SpriteNode = {
    width: 0,
    height: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    renderFlag: 0,
  };
  readonly renderData = new RenderData();
  readonly _assembler: SpriteAssembler;
  _vertsDirty = true;

  constructor() {
    this._assembler = Assembler.init(this);
  }

  setVertsDirty(): void {
    this._vertsDirty = true;
    this.node.renderFlag |= UPDATE_RENDER_DATA;
    console.log("RenderComponent.setVertsDirty -> UPDATE_RENDER_DATA");
  }
}
