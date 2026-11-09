import type Sprite from "../../../../components/CCSprite.ts";

const QUAD_INDICES = new Uint16Array([0, 1, 2, 2, 1, 3]);

export default class SimpleSpriteAssembler {
  updateRenderData(sprite: Sprite): void {
    if (!sprite.spriteFrame) return;
    const transformCount = sprite.node.worldTransformUpdateCount;
    if (!sprite._vertsDirty && sprite._lastTransformCount === transformCount) return;
    const { x, y } = sprite.node.getWorldPosition();
    const uv = sprite.spriteFrame.uv;
    sprite.vertices.set([
      x - 28, y - 28, uv[0], uv[1], x + 28, y - 28, uv[2], uv[3],
      x - 28, y + 28, uv[4], uv[5], x + 28, y + 28, uv[6], uv[7],
    ]);
    sprite._vertsDirty = false;
    sprite._lastTransformCount = transformCount;
  }

  fillBuffers(sprite: Sprite, batcher: import("../../assembler-2d.ts").WebGLBatcher): void {
    if (sprite.spriteFrame) batcher.submit(sprite.vertices, QUAD_INDICES, sprite.spriteFrame.texture);
  }
}
