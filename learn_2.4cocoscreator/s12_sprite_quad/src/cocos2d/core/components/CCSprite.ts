import type Node from "../CCNode.ts";
import type { RenderComponent, WebGLBatcher } from "../renderer/webgl/assembler-2d.ts";
import SimpleSpriteAssembler from "../renderer/webgl/assemblers/sprite/simple.ts";

export default class Sprite implements RenderComponent {
  readonly vertices = new Float32Array(8);
  readonly color = new Float32Array([1, 0.55, 0.12, 1]);
  _vertsDirty = true;
  private readonly _assembler = new SimpleSpriteAssembler();

  constructor(readonly node: Node) {}

  updateRenderData(): void {
    this._assembler.updateRenderData(this);
  }

  fillBuffers(batcher: WebGLBatcher): void {
    this._assembler.fillBuffers(this, batcher);
  }
}
