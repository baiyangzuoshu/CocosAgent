import { Material } from "../../asset/assets/material.ts";
import { PassInstance } from "./pass-instance.ts";

export class MaterialInstance extends Material {
  constructor(readonly parent: Material) {
    super();
    this.effectAsset = parent.effectAsset;
    this.technique = parent.technique;
    this.passes = parent.passes.map((pass) => new PassInstance(pass));
  }

  overridePipelineStates(overrides: Partial<PassInstance["state"]>, passIdx = 0): void {
    this.passes[passIdx].overridePipelineStates(overrides);
  }
}
