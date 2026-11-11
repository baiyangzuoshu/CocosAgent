import { SubModel, type Material, type RenderingSubMesh } from "./submodel.ts";

export class Model {
  readonly subModels: SubModel[] = [];
  node = "";
  enabled = false;
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    console.log(`Model.initialize for ${this.node}`);
  }

  initSubModel(index: number, subMesh: RenderingSubMesh, material: Material): void {
    this.initialize();
    const subModel = new SubModel();
    subModel.initialize(subMesh, material);
    this.subModels[index] = subModel;
  }
}

export class RenderScene {
  addModel(model: Model): void {
    console.log(`RenderScene.addModel: ${model.node} (${model.subModels.length} SubModel(s))`);
  }
}

export class Root {
  createModel(): Model {
    console.log("Root.createModel");
    return new Model();
  }
}
