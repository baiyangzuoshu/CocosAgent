import type { RenderData } from "./render-data.ts";
import type { UIRenderer } from "../framework/ui-renderer.ts";

export interface SpriteAssembler {
  updateRenderData(sprite: UIRenderer): void;
  fillBuffers(sprite: UIRenderer, batcher: { append(sprite: SpriteLike): void }): void;
}

export interface SpriteLike {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  uv: number[];
  color: string;
  renderData: RenderData;
}
