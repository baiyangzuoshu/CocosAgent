import type { CCEffectAsset } from "./CCEffectAsset.ts";
import { Effect } from "./effect.ts";
import { Technique } from "../../../renderer/core/technique.ts";
import { Pass } from "../../../renderer/core/pass.ts";

export function parseEffect(asset: CCEffectAsset): Effect {
  const techniques = asset.techniques.map((techniqueInfo) => {
    const passes = techniqueInfo.passes.map((passInfo) => new Pass(
      passInfo.name,
      passInfo.program,
      {
        enabled: passInfo.blendState.blend,
        src: passInfo.blendState.blendSrc,
        dst: passInfo.blendState.blendDst,
      },
    ));
    return new Technique(techniqueInfo.name, passes);
  });
  return new Effect(asset.name, techniques);
}
