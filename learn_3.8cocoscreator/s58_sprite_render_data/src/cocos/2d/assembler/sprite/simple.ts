import type { SpriteAssembler, SpriteLike } from "../../renderer/base.ts";
import type { UIRenderer } from "../../framework/ui-renderer.ts";

export class SimpleSpriteAssembler implements SpriteAssembler {
  updateRenderData(component: UIRenderer): void {
    const sprite = component as UIRenderer & SpriteLike;
    if (!sprite.renderData.vertDirty) return;

    const left = -sprite.anchorX * sprite.width;
    const bottom = -sprite.anchorY * sprite.height;
    const right = sprite.width + left;
    const top = sprite.height + bottom;
    const uv = sprite.uv;
    sprite.renderData.vertices = [
      { x: left, y: bottom, u: uv[0], v: uv[1], color: sprite.color },
      { x: right, y: bottom, u: uv[2], v: uv[3], color: sprite.color },
      { x: left, y: top, u: uv[4], v: uv[5], color: sprite.color },
      { x: right, y: top, u: uv[6], v: uv[7], color: sprite.color },
    ];
    sprite.renderData.updateRenderData();
    console.log("SimpleAssembler.updateRenderData -> local quad refreshed");
  }

  fillBuffers(component: UIRenderer, batcher: { append(sprite: SpriteLike): void }): void {
    const sprite = component as UIRenderer & SpriteLike;
    batcher.append(sprite);
    sprite.renderData.vertDirty = false;
  }
}
