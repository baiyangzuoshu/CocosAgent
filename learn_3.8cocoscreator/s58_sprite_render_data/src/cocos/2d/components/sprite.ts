import { SpriteAssemblerManager } from "../assembler/sprite/index.ts";
import { UIRenderer } from "../framework/ui-renderer.ts";
import type { SpriteLike } from "../renderer/base.ts";

export class Sprite extends UIRenderer implements SpriteLike {
  width = 0;
  height = 0;
  anchorX = 0.5;
  anchorY = 0.5;
  uv = [0, 0, 1, 0, 0, 1, 1, 1];
  color = "white";

  constructor() {
    super(SpriteAssemblerManager.getAssembler("SIMPLE"));
    this.markForUpdateRenderData();
  }

  setContentSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.markForUpdateRenderData();
  }
}
