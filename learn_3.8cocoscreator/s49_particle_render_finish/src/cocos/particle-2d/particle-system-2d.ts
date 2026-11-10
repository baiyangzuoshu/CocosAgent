import { ParticleAsset, type ParticleDictionary } from "./particle-asset.ts";
import { SpriteFrame, Texture2D } from "./sprite-frame.ts";
import { ParticleSimulator2D } from "./particle-simulator-2d.ts";
import { MeshRenderData, ParticleAssembler, type ParticleBatcher } from "./particle-renderer.ts";

class UIRenderer {
  onEnable(): void {}
}

export class ParticleSystem2D extends UIRenderer {
  totalParticles = 150;
  life = 0;
  emissionRate = 10;
  emitterMode = 0;
  speed = 0;
  gravityY = 0;
  spriteFrame: SpriteFrame | null = null;
  readonly _simulator: ParticleSimulator2D;
  readonly _assembler = new ParticleAssembler();
  autoRemoveOnFinish = true;
  nodeDestroyed = false;
  private _stopped = false;
  private _plistFile = "";
  private _finishHandled = false;

  constructor() {
    super();
    this._simulator = new ParticleSimulator2D(this);
  }

  __preload(file: ParticleAsset): void {
    this._plistFile = file.nativeUrl;
    this.spriteFrame = file.spriteFrame;
    this._initWithDictionary(file.nativeAsset);
  }

  private _initWithDictionary(dict: ParticleDictionary): void {
    this.totalParticles = Number(dict.maxParticles || 0);
    this.life = Number(dict.particleLifespan || 0);
    this.emissionRate = Number(dict.emissionRate || this.totalParticles / this.life || 0);
    this.emitterMode = Number(dict.emitterType || 0);
    this.speed = Number(dict.speed || 0);
    this.gravityY = Number(dict.gravityy || 0);
    this._initTextureWithDictionary(dict);
  }

  private _initTextureWithDictionary(dict: ParticleDictionary): void {
    if (this.spriteFrame) return;
    const textureUrl = new URL(dict.textureFileName, new URL(this._plistFile, window.location.href)).href;
    this.spriteFrame = new SpriteFrame(new Texture2D(textureUrl));
  }

  private _flushAssembler(): void {
    if (!this._simulator.renderData) {
      this._simulator.setRenderData(this._assembler.createData(this.totalParticles));
    }
  }

  resetSystem(): void {
    this._finishHandled = false;
    this._stopped = false;
    this.nodeDestroyed = false;
    this._flushAssembler();
    this._simulator.reset();
  }

  stopSystem(): void {
    this._stopped = true;
    this._simulator.stop();
  }

  lateUpdate(dt: number): void {
    this._flushAssembler();
    if (!this._simulator.finished) this._simulator.step(dt);
  }

  _render(batcher: ParticleBatcher): void {
    const data = this._simulator.renderData;
    if (!this._stopped && data && this.spriteFrame) batcher.commitComp(data);
  }

  _finishedSimulation(): void {
    if (this._finishHandled) return;
    this._finishHandled = true;
    if (this.autoRemoveOnFinish) {
      this.nodeDestroyed = true;
      this.destroyRenderData();
    }
  }

  destroyRenderData(): void {
    const data = this._simulator.renderData;
    if (!data) return;
    this._assembler.removeData(data);
    this._simulator.renderData = null;
  }
}
