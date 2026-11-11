export interface RenderingSubMesh {
  name: string;
  vertexCount: number;
  indexCount: number;
}

export interface Material {
  name: string;
  passes: string[];
}

export class SubModel {
  initialize(subMesh: RenderingSubMesh, material: Material): void {
    console.log(
      `SubModel.initialize ${subMesh.name}: InputAssembler(${subMesh.vertexCount} vertices, ${subMesh.indexCount} indices), passes=${material.passes.join(",")}`,
    );
  }
}
