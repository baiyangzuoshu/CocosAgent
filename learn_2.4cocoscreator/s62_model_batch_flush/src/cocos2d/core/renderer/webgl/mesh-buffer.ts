import type { ModelBatcher } from "./model-batcher.ts";

export class MeshBuffer {
  bufferId = 0;
  vertexOffset = 0;
  indiceOffset = 0;
  indiceStart = 0;
  private dirty = false;

  constructor(
    private readonly batcher: ModelBatcher,
    private readonly maxVertices: number,
  ) {}

  requestQuad(): void {
    if (this.vertexOffset + 4 > this.maxVertices) {
      this.uploadData();
      this.batcher._flush();
      this.switchBuffer();
    }
    this.vertexOffset += 4;
    this.indiceOffset += 6;
    this.dirty = true;
  }

  uploadData(): void {
    if (this.dirty) {
      console.log(
        "MeshBuffer upload:",
        "buffer",
        this.bufferId,
        "vertices",
        this.vertexOffset,
        "indices",
        this.indiceOffset,
      );
      this.dirty = false;
    }
  }

  forwardIndiceStartToOffset(): void {
    this.indiceStart = this.indiceOffset;
  }

  switchBuffer(): void {
    this.bufferId += 1;
    this.vertexOffset = 0;
    this.indiceOffset = 0;
    this.indiceStart = 0;
    console.log("MeshBuffer switch:", this.bufferId);
  }
}
