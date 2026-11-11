import type { GFXBuffer } from "../../gfx/base/buffer.ts";
import { InputAssembler } from "../../gfx/base/input-assembler.ts";
import { WebGLGfxBuffer } from "../../gfx/webgl/webgl-buffer.ts";

export class MeshBuffer {
  readonly vData = new Float32Array(16);
  readonly iData = new Uint16Array(6);
  readonly vertexBuffer: GFXBuffer;
  readonly indexBuffer: GFXBuffer;
  readonly inputAssembler: InputAssembler;
  byteOffset = 0;
  vertexOffset = 0;
  indexOffset = 0;
  private dirty = false;

  constructor(gl: WebGLRenderingContext) {
    this.vertexBuffer = new WebGLGfxBuffer(gl, gl.ARRAY_BUFFER);
    this.indexBuffer = new WebGLGfxBuffer(gl, gl.ELEMENT_ARRAY_BUFFER);
    this.inputAssembler = new InputAssembler(this.vertexBuffer, this.indexBuffer);
  }

  setDirty(): void {
    this.dirty = true;
  }

  uploadBuffers(): void {
    if (this.byteOffset === 0 || !this.dirty) return;

    const vertices = new Float32Array(this.vData.buffer, 0, this.byteOffset >> 2);
    const indices = new Uint16Array(this.iData.buffer, 0, this.indexOffset);

    if (this.byteOffset > this.vertexBuffer.size) this.vertexBuffer.resize(this.byteOffset);
    this.vertexBuffer.update(vertices);

    const indexBytes = this.indexOffset * Uint16Array.BYTES_PER_ELEMENT;
    if (indexBytes > this.indexBuffer.size) this.indexBuffer.resize(indexBytes);
    this.indexBuffer.update(indices);
    this.dirty = false;
  }
}
