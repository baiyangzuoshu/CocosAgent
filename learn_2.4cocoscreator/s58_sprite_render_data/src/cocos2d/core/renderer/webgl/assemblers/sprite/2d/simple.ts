import type { SpriteAssembler, SpriteData } from "../../../../assembler.ts";

export class SimpleSpriteAssembler implements SpriteAssembler {
  updateRenderData(sprite: SpriteData): void {
    if (!sprite._vertsDirty) return;

    const left = -sprite.node.anchorX * sprite.node.width;
    const bottom = -sprite.node.anchorY * sprite.node.height;
    const right = sprite.node.width + left;
    const top = sprite.node.height + bottom;
    const vertices = [
      { x: left, y: bottom, u: sprite.uv[0], v: sprite.uv[1], color: sprite.color },
      { x: right, y: bottom, u: sprite.uv[2], v: sprite.uv[3], color: sprite.color },
      { x: left, y: top, u: sprite.uv[4], v: sprite.uv[5], color: sprite.color },
      { x: right, y: top, u: sprite.uv[6], v: sprite.uv[7], color: sprite.color },
    ];
    sprite.renderData.updateMesh(vertices);
    sprite._vertsDirty = false;
    console.log("SimpleSpriteAssembler.updateRenderData -> 4 vertices");
  }

  updateColor(sprite: SpriteData, color: string): void {
    for (const vertex of sprite.renderData.vDatas) vertex.color = color;
    console.log("SimpleSpriteAssembler.updateColor -> all four corners");
  }

  fillBuffers(sprite: SpriteData): void {
    const vertices = sprite.renderData.vDatas;
    console.log(
      "SimpleSpriteAssembler.fillBuffers -> indices=" +
        sprite.renderData.iDatas.join(",") +
        " firstVertex=(" + (vertices[0]?.x ?? "pending") + "," +
        (vertices[0]?.y ?? "pending") + ")",
    );
  }
}
