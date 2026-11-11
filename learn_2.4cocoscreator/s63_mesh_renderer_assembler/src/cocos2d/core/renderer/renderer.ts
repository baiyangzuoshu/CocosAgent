import type { InputAssembler, MeshData } from "../mesh/CCMesh.ts";

export interface Material {
  name: string;
  hash: number;
}

export class Renderer {
  material: Material | null = null;
  cullingMask = 0;
  private vertexCount = 0;
  private indexCount = 0;

  _flush(): void {
    if (this.indexCount === 0) return;
    console.log(
      `Renderer._flush MeshBuffer: ${this.vertexCount} vertices, ${this.indexCount} indices`,
    );
    this.vertexCount = 0;
    this.indexCount = 0;
  }

  appendMeshData(ia: InputAssembler, data: MeshData): void {
    const vertexOffset = this.vertexCount;
    const rebasedIndices = data.indices.map((index) => index + vertexOffset);
    this.vertexCount += data.vertices.length / 3;
    this.indexCount += rebasedIndices.length;
    console.log(
      `MeshBuffer append ${ia.name}: vertexOffset=${vertexOffset}, indices=${rebasedIndices.join(",")}`,
    );
  }

  _flushIA(ia: InputAssembler): void {
    console.log(`Renderer._flushIA direct: ${ia.name} (${ia.indexCount} indices)`);
  }
}
