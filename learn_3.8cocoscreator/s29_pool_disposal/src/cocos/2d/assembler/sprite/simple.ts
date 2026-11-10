import type { Batcher2D, SpriteRenderData } from "../../renderer/batcher-2d.ts";
import type { Sprite } from "../../components/sprite.ts";

const QUAD_INDICES = new Uint16Array([0, 1, 2, 2, 1, 3]);

export class SimpleSpriteAssembler {
  createData(): SpriteRenderData {
    return {
      vertices: new Float32Array(16),
      indices: QUAD_INDICES,
      texture: null,
    };
  }

  updateRenderData(sprite: Sprite): void {
    if (!sprite.spriteFrame) return;
    const transformCount = sprite.node.worldTransformUpdateCount;
    if (sprite._lastTransformCount === transformCount && sprite.renderData.texture === sprite.spriteFrame.texture) return;
    const { x, y } = sprite.node.worldPosition;
    const uv = sprite.spriteFrame.uv;
    sprite.renderData.vertices.set([
      x - 28, y - 28, uv[0], uv[1], x + 28, y - 28, uv[2], uv[3],
      x - 28, y + 28, uv[4], uv[5], x + 28, y + 28, uv[6], uv[7],
    ]);
    sprite.renderData.texture = sprite.spriteFrame.texture;
    sprite._lastTransformCount = transformCount;
  }

  fillBuffers(sprite: Sprite, batcher: Batcher2D): void {
    batcher.commit(sprite.renderData);
  }
}
