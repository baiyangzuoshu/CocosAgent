import type { EffectAsset } from "./effect-asset.ts";
import { Pass } from "../../render-scene/core/pass.ts";

export class Material {
  effectAsset!: EffectAsset;
  technique = 0;
  passes: Pass[] = [];

  initialize(info: { effectAsset: EffectAsset; technique?: number }): void {
    this.effectAsset = info.effectAsset;
    this.technique = info.technique ?? 0;
    const technique = this.effectAsset.techniques[this.technique];
    this.passes = technique.passes.map((passInfo) => new Pass(passInfo.name, passInfo));
  }
}
