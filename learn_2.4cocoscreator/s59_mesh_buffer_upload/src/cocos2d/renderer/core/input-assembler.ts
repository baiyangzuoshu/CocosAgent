import { VertexBuffer } from "../gfx/vertex-buffer.ts";
import { IndexBuffer } from "../gfx/index-buffer.ts";

export class InputAssembler {
  constructor(
    readonly vertexBuffer: VertexBuffer,
    readonly indexBuffer: IndexBuffer,
    readonly primitiveType = "TRIANGLES",
  ) {}

  get count(): number {
    return this.indexBuffer.count;
  }
}
