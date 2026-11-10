import { ParticleAsset, type ParticleDictionary } from "./particle-asset.ts";
import { SpriteFrame, Texture2D } from "./sprite-frame.ts";
import { ParticleSimulator2D } from "./particle-simulator-2d.ts";

class UIRenderer {
  onEnable(): void {}
}

export class ParticleSystem2D extends UIRenderer {
  totalParticles = 150;
  life = 0;
  emissionRate = 10;
  emitterMode = 0;
  spriteFrame: SpriteFrame | null = null;
  readonly _simulator: ParticleSimulator2D;
  private _plistFile = "";

  constructor() {
    super();
    this._simulator = new ParticleSimulator2D(this);
  }

  __preload(file: ParticleAsset): void {
    this._applyFile(file);
  }

  private _applyFile(file: ParticleAsset): void {
    this._plistFile = file.nativeUrl;
    this.spriteFrame = file.spriteFrame;
    this._initWithDictionary(file.nativeAsset);
  }

  private _initWithDictionary(dict: ParticleDictionary): void {
    this.totalParticles = Number(dict.maxParticles || 0);
    this.life = Number(dict.particleLifespan || 0);
    this.emissionRate = Number(dict.emissionRate || this.totalParticles / this.life || 0);
    this.emitterMode = Number(dict.emitterType || 0);
    this._initTextureWithDictionary(dict);
  }

  private _initTextureWithDictionary(dict: ParticleDictionary): void {
    if (this.spriteFrame) return;
    const textureUrl = new URL(dict.textureFileName, new URL(this._plistFile, window.location.href)).href;
    this.spriteFrame = new SpriteFrame(new Texture2D(textureUrl));
  }
}
