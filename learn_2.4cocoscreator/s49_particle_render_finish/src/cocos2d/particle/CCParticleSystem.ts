import { ParticleAsset, SpriteFrame, Texture2D, type ParticleDictionary } from "./CCParticleAsset.ts";
import { ParticleSimulator } from "./particle-simulator.ts";
import { ParticleAssembler, type WebRenderer } from "./particle-renderer.ts";

export class ParticleSystem {
  totalParticles = 0;
  life = 0;
  emissionRate = 0;
  emitterMode = 0;
  speed = 0;
  gravityY = 0;
  spriteFrame: SpriteFrame | null = null;
  readonly _assembler = new ParticleAssembler();
  readonly _simulator: ParticleSimulator;
  autoRemoveOnFinish = true;
  nodeDestroyed = false;
  renderEnabled = true;
  private _finishHandled = false;
  private _plistFile = "";

  constructor() {
    this._simulator = new ParticleSimulator(this);
  }

  __preload(file: ParticleAsset): void {
    this._plistFile = file.nativeUrl;
    this.spriteFrame = file.spriteFrame;
    this._initWithDictionary(file.nativeAsset);
  }

  private _initWithDictionary(dict: ParticleDictionary): void {
    this.totalParticles = Number.parseInt(String(dict.maxParticles || 0), 10);
    this.life = Number(dict.particleLifespan || 0);
    this.emissionRate = Number(dict.emissionRate || this.totalParticles / this.life || 0);
    this.emitterMode = Number.parseInt(String(dict.emitterType || 0), 10);
    this.speed = Number(dict.speed || 0);
    this.gravityY = Number(dict.gravityy || 0);
    this._assembler.setCapacity(this.totalParticles);

    const texturePath = new URL(dict.textureFileName, new URL(this._plistFile, window.location.href)).href;
    if (!this.spriteFrame) this.spriteFrame = new SpriteFrame(new Texture2D(texturePath));
  }

  resetSystem(): void {
    this._finishHandled = false;
    this.nodeDestroyed = false;
    this.renderEnabled = true;
    this._simulator.reset();
  }

  stopSystem(): void {
    this._simulator.stop();
  }

  lateUpdate(dt: number): void {
    if (!this._simulator.finished) this._simulator.step(dt);
  }

  render(renderer: WebRenderer): void {
    if (this.renderEnabled) this._assembler.fillBuffers(renderer);
  }

  _finishedSimulation(): void {
    if (this._finishHandled) return;
    this._finishHandled = true;
    this.renderEnabled = false;
    this._assembler.clear();
    if (this.autoRemoveOnFinish) {
      this.nodeDestroyed = true;
      this._assembler.destroy();
    }
  }
}
