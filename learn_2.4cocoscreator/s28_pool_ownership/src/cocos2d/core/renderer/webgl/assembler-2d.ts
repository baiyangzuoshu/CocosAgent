import type Texture2D from "../../assets/CCTexture2D.ts";

export interface WebGLBatcher {
  submit(vertices: Float32Array, indices: Uint16Array, texture: Texture2D): void;
}

export interface RenderComponent {
  updateRenderData(): void;
  fillBuffers(batcher: WebGLBatcher): void;
}
