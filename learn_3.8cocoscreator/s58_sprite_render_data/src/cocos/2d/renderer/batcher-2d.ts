import type { Sprite } from "../components/sprite.ts";

export class Batcher2D {
  commitComp(sprite: Sprite): void {
    console.log("Batcher2D.commitComp -> assembler.fillBuffers");
    sprite.assembler.fillBuffers(sprite, {
      append(current) {
        console.log(
          "RenderData -> vertices=" + current.renderData.vertices.length +
            " indices=" + current.renderData.indices.join(","),
        );
      },
    });
  }
}
