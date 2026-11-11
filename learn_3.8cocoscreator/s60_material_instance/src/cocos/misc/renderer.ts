import { Material } from "../asset/assets/material.ts";
import { MaterialInstance } from "../render-scene/core/material-instance.ts";

export class Renderer {
  private readonly instances = new Map<number, MaterialInstance>();

  constructor(public sharedMaterials: Material[]) {}

  getMaterialInstance(index: number): MaterialInstance | null {
    const parent = this.sharedMaterials[index];
    if (!parent) return null;
    let instance = this.instances.get(index);
    if (!instance) {
      instance = new MaterialInstance(parent);
      this.instances.set(index, instance);
    }
    return instance;
  }

  hasMaterialInstance(index: number): boolean {
    return this.instances.has(index);
  }
}
