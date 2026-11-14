import type { TexturePixels } from "../../gfx/webgl2/webgl2-device.ts";
export interface SpriteVertexData { position: Float32Array; uv: Float32Array; color: Float32Array; mvp: Float32Array; }
export class Sprite {
  constructor(readonly vertex: SpriteVertexData, readonly texture: TexturePixels) {}
}
