export interface WebGLBatcher {
  submit(vertices: Float32Array, indices: Uint16Array, color: Float32Array): void;
}

export interface RenderComponent {
  updateRenderData(): void;
  fillBuffers(batcher: WebGLBatcher): void;
}
