import { Model, RenderScene, Root } from "../render-scene/scene/model.ts";

export class ModelRenderer {
  protected _model: Model | null = null;

  constructor(
    protected readonly node: string,
    protected readonly root: Root,
    protected readonly renderScene: RenderScene,
  ) {}

  protected _createModel(): void {
    this._model = this.root.createModel();
    this._model.node = this.node;
  }

  protected _attachToScene(): void {
    if (this._model) this.renderScene.addModel(this._model);
  }
}
