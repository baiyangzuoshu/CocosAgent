import type { SpriteAssembler } from "../renderer/base.ts";
import { RenderData } from "../renderer/render-data.ts";
import { uiRendererManager } from "./ui-renderer-manager.ts";

export class UIRenderer {
  renderData = new RenderData();
  assembler: SpriteAssembler;

  constructor(assembler: SpriteAssembler) {
    this.assembler = assembler;
  }

  markForUpdateRenderData(): void {
    this.renderData.vertDirty = true;
    uiRendererManager.markDirtyRenderer(this);
    console.log("UIRenderer._markForUpdateRenderData -> vertDirty");
  }

  updateRenderer(): void {
    this.assembler.updateRenderData(this);
  }
}
