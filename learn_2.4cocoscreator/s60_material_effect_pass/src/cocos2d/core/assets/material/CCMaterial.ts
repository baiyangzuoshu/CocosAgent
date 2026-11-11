import { CCEffectAsset } from "./CCEffectAsset.ts";
import { Effect } from "./effect.ts";

export class Material {
  private _effect: Effect;
  private _techniqueIndex = 0;

  constructor(readonly effectAsset: CCEffectAsset) {
    this._effect = effectAsset.getInstantiatedEffect();
  }

  get effect(): Effect {
    return this._effect;
  }

  set techniqueIndex(index: number) {
    this._techniqueIndex = index;
    this._effect.switchTechnique(index);
  }

  get techniqueIndex(): number {
    return this._techniqueIndex;
  }
}
