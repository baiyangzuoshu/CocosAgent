import type { MeshData, InputAssembler } from "./CCMesh.ts";
import type { MeshRenderer } from "./CCMeshRenderer.ts";
import type { Material, Renderer } from "../renderer/renderer.ts";

export class MeshRendererAssembler {
  fillBuffers(comp: MeshRenderer, renderer: Renderer): void {
    const mesh = comp.mesh;
    if (!mesh) return;

    mesh._uploadData();
    const isCullingMaskSame = renderer.cullingMask === comp.cullingMask;

    for (let i = 0; i < mesh.subMeshes.length; i++) {
      const ia = mesh.subMeshes[i];
      const data: MeshData = mesh.subDatas[i];
      const material: Material = comp.materials[i] ?? comp.materials[0];

      if (!comp.enableAutoBatch || !data.canBatch || ia.primitiveType !== "triangles") {
        renderer._flush();
        renderer.material = material;
        renderer.cullingMask = comp.cullingMask;
        renderer._flushIA(ia);
        continue;
      }

      if (
        !isCullingMaskSame ||
        renderer.material?.hash !== material.hash
      ) {
        renderer._flush();
      }

      renderer.material = material;
      renderer.cullingMask = comp.cullingMask;
      renderer.appendMeshData(ia, data);
    }
  }
}

export type { InputAssembler };
