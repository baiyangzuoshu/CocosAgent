import type Texture2D from "./CCTexture2D.ts";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default class SpriteFrame {
  readonly uv: Float32Array;

  constructor(readonly texture: Texture2D, readonly rect: Rect) {
    const u0 = rect.x / texture.width;
    const u1 = (rect.x + rect.width) / texture.width;
    const v0 = rect.y / texture.height;
    const v1 = (rect.y + rect.height) / texture.height;
    this.uv = new Float32Array([u0, v1, u1, v1, u0, v0, u1, v0]);
  }
}
