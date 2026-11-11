import { BufferAccessor } from "./buffer-accessor.ts";
import { MeshBuffer } from "./mesh-buffer.ts";
import type { InputAssembler } from "../../gfx/base/input-assembler.ts";

export class LinearBufferAccessor extends BufferAccessor {
  private indexStart = 0;

  constructor(gl: WebGLRenderingContext) {
    super();
    this._buffers.push(new MeshBuffer(gl));
  }

  get meshBuffer(): MeshBuffer {
    return this._buffers[0];
  }

  appendBuffers(vertices: Float32Array, indices: Uint16Array): void {
    const buffer = this.meshBuffer;
    const vertexId = buffer.vertexOffset;
    buffer.vData.set(vertices, buffer.byteOffset >> 2);

    for (let i = 0; i < indices.length; i++) {
      buffer.iData[buffer.indexOffset + i] = vertexId + indices[i];
    }

    buffer.vertexOffset += vertices.length / 2;
    buffer.indexOffset += indices.length;
    buffer.byteOffset += vertices.byteLength;
    buffer.setDirty();
  }

  recordBatch(): InputAssembler {
    const buffer = this.meshBuffer;
    const inputAssembler = buffer.inputAssembler;
    inputAssembler.firstIndex = this.indexStart;
    inputAssembler.indexCount = buffer.indexOffset - this.indexStart;
    this.indexStart = buffer.indexOffset;
    return inputAssembler;
  }

  override uploadBuffers(): void {
    for (const buffer of this._buffers) buffer.uploadBuffers();
  }
}
