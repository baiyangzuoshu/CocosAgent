import { parseEffect } from "./effect-parser.ts";
import { Effect } from "./effect.ts";

export interface PassInfo {
  name: string;
  program: string;
  blendState: { blend: boolean; blendSrc: number; blendDst: number };
}

export interface TechniqueInfo {
  name: string;
  passes: PassInfo[];
}

export class CCEffectAsset {
  private effect: Effect | null = null;

  constructor(readonly name: string, readonly techniques: TechniqueInfo[]) {}

  getEffect(): Effect {
    if (!this.effect) this.effect = parseEffect(this);
    return this.effect;
  }

  getInstantiatedEffect(): Effect {
    return this.getEffect().clone();
  }
}
