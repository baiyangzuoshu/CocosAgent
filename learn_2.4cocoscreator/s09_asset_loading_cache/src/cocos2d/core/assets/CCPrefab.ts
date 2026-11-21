import { CCAsset } from "./CCAsset.ts";

export interface PrefabNode {
  _instantiate(): PrefabNode;
}

export enum OptimizationPolicy {
  SINGLE_INSTANCE,
  MULTI_INSTANCE,
  AUTO,
}

/** Cropped source model of cc.Prefab; JIT/editor integration is omitted. */
export class Prefab extends CCAsset {
  private _instantiatedTimes = 0;
  optimizationPolicy = OptimizationPolicy.AUTO;

  constructor(uuid: string, readonly data: PrefabNode) {
    super(uuid);
  }

  _instantiate(): PrefabNode {
    // Creator may select a generated JIT function; this crop keeps the
    // source's essential contract: instantiate the stored Node template.
    this._instantiatedTimes++;
    return this.data._instantiate();
  }

  get instantiatedTimes(): number {
    return this._instantiatedTimes;
  }
}
