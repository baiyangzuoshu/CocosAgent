import type { Material } from "../../components/render-component.ts";
import { MeshBuffer } from "./mesh-buffer.ts";

export interface BatchModel {
  material: Material;
  cullingMask: number;
  bufferId: number;
  firstIndex: number;
  indexCount: number;
}

export class ModelBatcher {
  readonly models: BatchModel[] = [];
  readonly buffer: MeshBuffer;
  walking = false;
  material: Material | null = null;
  cullingMask = 1;

  constructor(private readonly maxVertices = 8) {
    this.buffer = new MeshBuffer(this, maxVertices);
  }

  reset(): void {
    this.models.length = 0;
    this.material = null;
    this.cullingMask = 1;
    this.buffer.switchBuffer();
  }

  _flush(): void {
    const indexCount = this.buffer.indiceOffset - this.buffer.indiceStart;
    if (!this.walking || !this.material || indexCount <= 0) return;

    this.models.push({
      material: this.material,
      cullingMask: this.cullingMask,
      bufferId: this.buffer.bufferId,
      firstIndex: this.buffer.indiceStart,
      indexCount,
    });
    console.log(
      "ModelBatcher flush:",
      this.material.name,
      "buffer",
      this.buffer.bufferId,
      "indices",
      indexCount,
    );
    this.buffer.forwardIndiceStartToOffset();
  }

  terminate(): void {
    this._flush();
    this.buffer.uploadData();
    this.walking = false;
  }
}
