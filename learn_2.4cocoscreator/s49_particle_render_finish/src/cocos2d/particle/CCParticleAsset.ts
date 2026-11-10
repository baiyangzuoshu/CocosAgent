export interface ParticleDictionary {
  maxParticles: number;
  particleLifespan: number;
  emissionRate: number;
  emitterType: number;
  textureFileName: string;
  speed: number;
  gravityy: number;
}

export class Texture2D {
  constructor(public readonly url: string) {}
}

export class SpriteFrame {
  constructor(
    public readonly texture: Texture2D,
    public readonly rect = { x: 0, y: 0, width: 16, height: 16 },
  ) {}
}

export class ParticleAsset {
  constructor(
    public readonly nativeUrl: string,
    public readonly nativeAsset: ParticleDictionary,
    public readonly spriteFrame: SpriteFrame | null,
  ) {}
}
