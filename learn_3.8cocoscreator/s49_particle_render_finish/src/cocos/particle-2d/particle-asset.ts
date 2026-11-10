import { SpriteFrame } from "./sprite-frame.ts";

export interface ParticleDictionary {
  maxParticles: number;
  particleLifespan: number;
  emissionRate: number;
  emitterType: number;
  textureFileName: string;
  speed: number;
  gravityy: number;
}

export class ParticleAsset {
  constructor(
    public readonly nativeUrl: string,
    public readonly nativeAsset: ParticleDictionary,
    public readonly spriteFrame: SpriteFrame | null,
  ) {}
}
