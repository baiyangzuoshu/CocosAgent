import type { Batcher2D, SpriteRenderData } from "../../renderer/batcher-2d.ts";
import type { Sprite } from "../../components/sprite.ts";

const QUAD_INDICES = new Uint16Array([0, 1, 2, 2, 1, 3]);

export class SimpleSpriteAssembler {
  createData(): SpriteRenderData {
    return {
      vertices: new Float32Array(8),
      indices: QUAD_INDICES,
      color: new Float32Array([0.25, 0.78, 1, 1]),
    };
  }

  updateRenderData(sprite: Sprite): void {
    const transformCount = sprite.node.worldTransformUpdateCount;
    if (sprite._lastTransformCount === transformCount) return;
    const { x, y } = sprite.node.worldPosition;
    sprite.renderData.vertices.set([x - 28, y - 28, x + 28, y - 28, x - 28, y + 28, x + 28, y + 28]);
    sprite._lastTransformCount = transformCount;
  }

  fillBuffers(sprite: Sprite, batcher: Batcher2D): void {
    batcher.commit(sprite.renderData);
  }
}
