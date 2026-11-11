import { UPDATE_RENDER_DATA } from "../components/CCRenderComponent.ts";
import type { CCSprite } from "../components/CCSprite.ts";

export class RenderFlow {
  render(sprite: CCSprite): void {
    if (sprite.node.renderFlag & UPDATE_RENDER_DATA) {
      sprite._assembler.updateRenderData(sprite);
      sprite.node.renderFlag &= ~UPDATE_RENDER_DATA;
      console.log("RenderFlow cleared UPDATE_RENDER_DATA");
    }
    sprite._assembler.fillBuffers(sprite);
  }
}
