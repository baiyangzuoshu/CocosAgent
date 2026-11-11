export type PrimitiveType = "triangles" | "lines";

export interface InputAssembler {
  name: string;
  primitiveType: PrimitiveType;
  indexCount: number;
}

export interface MeshData {
  canBatch: boolean;
  vertices: number[];
  indices: number[];
}

export class Mesh {
  readonly subMeshes: InputAssembler[];
  readonly subDatas: MeshData[];

  constructor(subMeshes: InputAssembler[], subDatas: MeshData[]) {
    this.subMeshes = subMeshes;
    this.subDatas = subDatas;
  }

  _uploadData(): void {
    console.log(`Mesh._uploadData: ${this.subMeshes.length} submesh(es) ready`);
  }
}
