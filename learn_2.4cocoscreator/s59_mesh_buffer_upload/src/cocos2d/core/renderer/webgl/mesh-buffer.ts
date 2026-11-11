import { RenderData } from "../render-data.ts";
import { VertexBuffer } from "../../../renderer/gfx/vertex-buffer.ts";
import { IndexBuffer } from "../../../renderer/gfx/index-buffer.ts";

export class MeshBuffer {
  private readonly vData = new Float32Array(16);
  private readonly iData = new Uint16Array(6);
  readonly vertexBuffer: VertexBuffer;
  readonly indexBuffer: IndexBuffer;
  private byteOffset = 0;
  private indiceOffset = 0;
  private dirty = false;

  constructor(gl: WebGLRenderingContext) {
    this.vertexBuffer = new VertexBuffer(gl, 2 * Float32Array.BYTES_PER_ELEMENT);
    this.indexBuffer = new IndexBuffer(gl);
  }

  append(data: RenderData): void {
    this.vData.set(data.vertices, this.byteOffset >> 2);
    this.iData.set(data.indices, this.indiceOffset);
    this.byteOffset += data.vertices.byteLength;
    this.indiceOffset += data.indices.length;
    this.dirty = true;
  }

  uploadData(): void {
    if (this.byteOffset === 0 || !this.dirty) return;

    const vertices = new Float32Array(this.vData.buffer, 0, this.byteOffset >> 2);
    const indices = new Uint16Array(this.iData.buffer, 0, this.indiceOffset);
    this.vertexBuffer.update(0, vertices);
    this.indexBuffer.update(0, indices);
    this.dirty = false;
  }
}
