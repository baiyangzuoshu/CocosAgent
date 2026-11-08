import type Node from "../CCNode.ts";
import type SpriteFrame from "../assets/CCSpriteFrame.ts";
import type { RenderComponent, WebGLBatcher } from "../renderer/webgl/assembler-2d.ts";
import SimpleSpriteAssembler from "../renderer/webgl/assemblers/sprite/simple.ts";

export default class Sprite implements RenderComponent {
  readonly vertices = new Float32Array(16);
  spriteFrame: SpriteFrame | null = null;
  _vertsDirty = true;
  _lastTransformCount = -1;
  private readonly _assembler = new SimpleSpriteAssembler();

  constructor(readonly node: Node) {}

  setSpriteFrame(spriteFrame: SpriteFrame): void {
    this.spriteFrame = spriteFrame;
    this._vertsDirty = true;
  }

  updateRenderData(): void {
    this._assembler.updateRenderData(this);
  }

  fillBuffers(batcher: WebGLBatcher): void {
    this._assembler.fillBuffers(this, batcher);
  }
}
