import { EffectAsset } from "./CCEffectAsset.ts";
export class Material {
  constructor(readonly effect: EffectAsset, readonly uniforms: Record<string, Float32Array>) {}
}
