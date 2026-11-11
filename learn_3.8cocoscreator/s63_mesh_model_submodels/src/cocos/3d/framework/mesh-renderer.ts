import { ModelRenderer } from "../../misc/model-renderer.ts";
import { Model, RenderScene, Root } from "../../render-scene/scene/model.ts";
import type { Material, RenderingSubMesh } from "../../render-scene/scene/submodel.ts";

export interface Mesh {
  renderingSubMeshes: RenderingSubMesh[];
}

export class MeshRenderer extends ModelRenderer {
  constructor(
    node: string,
    root: Root,
    renderScene: RenderScene,
    private readonly mesh: Mesh,
    private readonly materials: Material[],
  ) {
    super(node, root, renderScene);
  }

  onEnable(): void {
    this._updateModels();
    this._attachToScene();
  }

  private _updateModels(): void {
    if (this._model) {
      this._model.initialize();
    } else {
      this._createModel();
    }
    this._updateModelParams();
  }

  private _updateModelParams(): void {
    const model = this._model as Model;
    for (let i = 0; i < this.mesh.renderingSubMeshes.length; i++) {
      const subMesh = this.mesh.renderingSubMeshes[i];
      const material = this.materials[i] ?? this.materials[0];
      model.initSubModel(i, subMesh, material);
    }
    model.enabled = true;
  }
}
