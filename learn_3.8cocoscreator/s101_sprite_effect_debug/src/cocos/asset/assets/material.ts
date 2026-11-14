import { EffectAsset } from "./effect-asset.ts";
export class Material {
  constructor(readonly effect: EffectAsset, readonly uniforms: Record<string, Float32Array>) {}
}
