import type { MeshBuffer } from "./mesh-buffer.ts";

export class BufferAccessor {
  protected readonly _buffers: MeshBuffer[] = [];

  uploadBuffers(): void {}
}
