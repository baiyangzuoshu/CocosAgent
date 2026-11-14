import type { TexturePixels } from "../../renderer/gfx/device.ts";
export interface SpriteVertexData { position: Float32Array; uv: Float32Array; color: Float32Array; mvp: Float32Array; }
export class Sprite {
  constructor(readonly vertex: SpriteVertexData, readonly texture: TexturePixels) {}
}
