import type Sprite from "../../../../components/CCSprite.ts";

const QUAD_INDICES = new Uint16Array([0, 1, 2, 2, 1, 3]);

export default class SimpleSpriteAssembler {
  updateRenderData(sprite: Sprite): void {
    if (!sprite._vertsDirty) return;
    const { x, y } = sprite.node.getWorldPosition();
    sprite.vertices.set([x - 28, y - 28, x + 28, y - 28, x - 28, y + 28, x + 28, y + 28]);
    sprite._vertsDirty = false;
  }

  fillBuffers(sprite: Sprite, batcher: import("../../assembler-2d.ts").WebGLBatcher): void {
    batcher.submit(sprite.vertices, QUAD_INDICES, sprite.color);
  }
}
