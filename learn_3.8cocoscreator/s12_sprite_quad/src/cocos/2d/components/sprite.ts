import type { Node } from "../../scene-graph/node.ts";
import type { RenderComponent, SpriteRenderData, Batcher2D } from "../renderer/batcher-2d.ts";
import { SimpleSpriteAssembler } from "../assembler/sprite/simple.ts";

export class Sprite implements RenderComponent {
  readonly renderData: SpriteRenderData;
  _lastTransformCount = -1;
  private readonly _assembler = new SimpleSpriteAssembler();

  constructor(readonly node: Node) {
    this.renderData = this._assembler.createData();
  }

  updateRenderData(): void {
    this._assembler.updateRenderData(this);
  }

  fillBuffers(batcher: Batcher2D): void {
    this._assembler.fillBuffers(this, batcher);
  }
}
