import type { Node } from "../../scene-graph/node.ts";
import type { RenderComponent, SpriteRenderData, Batcher2D } from "../renderer/batcher-2d.ts";
import { SimpleSpriteAssembler } from "../assembler/sprite/simple.ts";
import type { SpriteFrame } from "../assets/sprite-frame.ts";

export class Sprite implements RenderComponent {
  readonly renderData: SpriteRenderData;
  _lastTransformCount = -1;
  spriteFrame: SpriteFrame | null = null;
  private readonly _assembler = new SimpleSpriteAssembler();

  constructor(readonly node: Node) {
    this.renderData = this._assembler.createData();
  }

  setSpriteFrame(spriteFrame: SpriteFrame): void {
    this.spriteFrame = spriteFrame;
    this.renderData.texture = spriteFrame.texture;
    this._lastTransformCount = -1;
  }

  updateRenderData(): void {
    this._assembler.updateRenderData(this);
  }

  fillBuffers(batcher: Batcher2D): void {
    this._assembler.fillBuffers(this, batcher);
  }
}
