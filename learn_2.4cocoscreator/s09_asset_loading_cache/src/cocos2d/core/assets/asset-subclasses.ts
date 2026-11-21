import { CCAsset } from "./CCAsset.ts";
import { Texture2D } from "./CCTexture2D.ts";

type Rect = { x: number; y: number; width: number; height: number };

// These are source-shaped crops. Classes whose Creator source only declares
// Asset fields remain data holders; platform/editor integrations are omitted.
export class TextAsset extends CCAsset {
  constructor(uuid: string, readonly text = "") { super(uuid); }
  override toString(): string { return this.text; }
}

export class BufferAsset extends CCAsset {
  private _buffer: ArrayBuffer;
  constructor(uuid: string, nativeAsset: ArrayBuffer | ArrayBufferView) {
    super(uuid);
    this._buffer = ArrayBuffer.isView(nativeAsset) ? nativeAsset.buffer as ArrayBuffer : nativeAsset;
  }
  get nativeAsset(): ArrayBuffer { return this._buffer; }
  set nativeAsset(value: ArrayBuffer | ArrayBufferView) {
    this._buffer = ArrayBuffer.isView(value) ? value.buffer as ArrayBuffer : value;
  }
  buffer(): ArrayBuffer { return this._buffer; }
}

export class SceneAsset extends CCAsset {
  asyncLoadAssets = false;
  constructor(uuid: string, public scene: unknown = null) { super(uuid); }
}

export class SpriteFrame extends CCAsset {
  name = "";
  private _texture: Texture2D | null;
  private _rect: Rect;
  constructor(uuid: string, texture: Texture2D | null, rect: Rect) {
    super(uuid);
    this._texture = texture;
    this._rect = rect;
  }
  getTexture(): Texture2D | null { return this._texture; }
  setTexture(texture: Texture2D, rect?: Rect): boolean {
    if (texture === this._texture && !rect) return true;
    this._texture = texture;
    if (rect) this._rect = rect;
    else this._rect = { x: 0, y: 0, width: texture.width, height: texture.height };
    return true;
  }
  getUV(): [number, number, number, number] {
    const width = this._texture?.width ?? 0;
    const height = this._texture?.height ?? 0;
    if (width === 0 || height === 0) return [0, 0, 0, 0];
    return [
      this._rect.x / width,
      this._rect.y / height,
      (this._rect.x + this._rect.width) / width,
      (this._rect.y + this._rect.height) / height,
    ];
  }
}

export class SpriteAtlas extends CCAsset {
  constructor(uuid: string, readonly spriteFrames: Record<string, SpriteFrame> = {}) { super(uuid); }
  getTexture(): Texture2D | null {
    const first = Object.keys(this.spriteFrames)[0];
    return first ? this.getSpriteFrame(first)?.getTexture() ?? null : null;
  }
  getSpriteFrame(name: string): SpriteFrame | null {
    const frame = this.spriteFrames[name];
    if (!frame) return null;
    if (!frame.name) frame.name = name;
    return frame;
  }
  getSpriteFrames(): SpriteFrame[] {
    return Object.keys(this.spriteFrames)
      .map((name) => this.getSpriteFrame(name))
      .filter((frame): frame is SpriteFrame => frame !== null);
  }
}

// cc.Font, cc.VideoClip, cc.Script and its language subclasses are marker or
// EventTarget-mixed types in this source slice; they have no custom core method.
export class Font extends CCAsset {}

export interface SpriteFrameKey { frame: number; value: SpriteFrame; }
export class AnimationClip extends CCAsset {
  duration = 0;
  sample = 60;
  speed = 1;
  wrapMode = 0;
  curveData: Record<string, unknown> = {};
  events: unknown[] = [];

  onLoad(): void {
    this.duration = Number.parseFloat(String(this.duration));
    this.speed = Number.parseFloat(String(this.speed));
    this.wrapMode = Number.parseInt(String(this.wrapMode), 10);
    this.sample = Number.parseFloat(String(this.sample));
  }

  static createFromSpriteFrames(uuid: string, frames: SpriteFrame[], sample = 60): AnimationClip | null {
    if (frames.length === 0) return null;
    const clip = new AnimationClip(uuid);
    clip.sample = sample;
    clip.duration = frames.length / sample;
    clip.curveData = {
      comps: {
        "cc.Sprite": {
          spriteFrame: frames.map((frame, i) => ({ frame: i / sample, value: frame })),
        },
      },
    };
    return clip;
  }
}

export class ParticleAsset extends CCAsset {
  constructor(uuid: string, public spriteFrame: SpriteFrame | null = null) { super(uuid); }
}

export class TiledMapAsset extends CCAsset {
  tmxXmlStr = "";
  textures: Texture2D[] = [];
  textureNames: string[] = [];
  imageLayerTextures: Texture2D[] = [];
  imageLayerTextureNames: string[] = [];
  tsxFiles: TextAsset[] = [];
  tsxFileNames: string[] = [];
}

export class AudioClip extends CCAsset {
  duration = 0;
  loadMode = 0;
  private _audio: AudioBuffer | HTMLAudioElement | null = null;
  private _loading = false;
  private readonly _loadListeners: Array<() => void> = [];

  constructor(uuid: string) {
    super(uuid);
    this.loaded = false;
  }

  set nativeAsset(value: AudioBuffer | HTMLAudioElement | null) {
    this._audio = value;
    if (value) {
      this.loaded = true;
      for (const callback of this._loadListeners.splice(0)) callback();
    }
  }
  get nativeAsset(): AudioBuffer | HTMLAudioElement | null { return this._audio; }

  _ensureLoaded(loadNative: (done: (asset: AudioBuffer | HTMLAudioElement | null) => void) => void,
    onComplete?: () => void): void {
    if (this.loaded) { onComplete?.(); return; }
    if (onComplete) this._loadListeners.push(onComplete);
    if (this._loading) return;
    this._loading = true;
    loadNative((asset) => {
      this._loading = false;
      this.nativeAsset = asset;
    });
  }
}

export class VideoClip extends CCAsset {
  // Creator mixes EventTarget into this Asset; native video lifecycle is external.
}

export class Material extends CCAsset {
  private _effectAsset: EffectAsset | null = null;
  private _effect: EffectTemplate | null = null;
  private _techniqueIndex = 0;
  properties: Record<string, unknown> = {};
  set effectAsset(asset: EffectAsset | null) {
    this._effectAsset = asset;
    this._effect = asset?.getInstantiatedEffect() ?? null;
  }
  get effectAsset(): EffectAsset | null { return this._effectAsset; }
  get effect(): EffectTemplate | null { return this._effect; }
  get techniqueIndex(): number { return this._techniqueIndex; }
  set techniqueIndex(index: number) {
    this._techniqueIndex = index;
    this._effect?.switchTechnique(index);
  }
}

export class EffectAsset extends CCAsset {
  properties: Record<string, unknown> = {};
  techniques: unknown[] = [];
  shaders: unknown[] = [];
  private _effect: EffectTemplate | null = null;

  constructor(uuid: string, private readonly parseEffect: (asset: EffectAsset) => EffectTemplate) {
    super(uuid);
  }

  _initEffect(): void {
    if (!this._effect) this._effect = Object.freeze(this.parseEffect(this));
  }
  getEffect(): EffectTemplate | null {
    this._initEffect();
    return this._effect;
  }
  getInstantiatedEffect(): EffectTemplate {
    return this.getEffect()!.clone();
  }
}

export interface EffectTemplate {
  clone(): EffectTemplate;
  switchTechnique(index: number): void;
}

export interface ModelNode {
  children?: Array<number | ModelNode>;
  position?: number[];
  scale?: number[];
  quat?: number[];
  path?: string;
  bindpose?: unknown[];
  uniqueBindPose?: unknown;
}

export class Model extends CCAsset {
  nodes: ModelNode[] = [];
  rootNode: ModelNode | null = null;
  constructor(uuid: string) {
    super(uuid);
    this.loaded = false;
  }
  onLoad(): void {
    this.rootNode = this.nodes[0] ?? null;
    for (const node of this.nodes) {
      if (node.children) {
        node.children = node.children.map((child) =>
          typeof child === "number" ? this.nodes[child] ?? child : child
        );
      }
    }
  }
}

export class Mesh extends CCAsset {
  private _buffer: ArrayBuffer | null = null;
  vertexBundles: unknown[] = [];
  primitives: Array<{
    vertexBundleIndices: number[];
    indexRange: { offset: number; length: number };
    indexUnit?: number;
  }> = [];
  vertexBundleRanges: Array<{ offset: number; length: number }> = [];
  subMeshes: Array<{ vertexData: Uint8Array; indexData: Uint8Array; indexUnit: number }> = [];

  constructor(uuid: string) {
    super(uuid);
    this.loaded = false;
  }

  set nativeAsset(value: ArrayBuffer | ArrayBufferView) {
    this._buffer = ArrayBuffer.isView(value) ? value.buffer as ArrayBuffer : value;
    this.initWithBuffer();
  }
  get nativeAsset(): ArrayBuffer | null { return this._buffer; }
  initWithBuffer(): void {
    if (!this._buffer) return;
    this.subMeshes = this.primitives.map((primitive) => {
      const vertexRange = this.vertexBundleRanges[primitive.vertexBundleIndices[0]];
      return {
        vertexData: new Uint8Array(this._buffer as ArrayBuffer, vertexRange.offset, vertexRange.length),
        indexData: new Uint8Array(this._buffer as ArrayBuffer, primitive.indexRange.offset, primitive.indexRange.length),
        indexUnit: primitive.indexUnit ?? 2,
      };
    });
    this.loaded = true;
  }
}

export class Skeleton extends CCAsset {
  model: Model | null = null;
  jointIndices: number[] = [];
  skinIndex = -1;
  jointPaths: string[] = [];
  bindposes: unknown[] = [];
  uniqueBindPoses: unknown[] = [];

  constructor(uuid: string) {
    super(uuid);
    this.loaded = false;
  }

  onLoad(): void {
    if (!this.model) return;
    for (const [slot, nodeIndex] of this.jointIndices.entries()) {
      const node = this.model.nodes[nodeIndex];
      if (!node) continue;
      this.jointPaths[slot] = node.path ?? "";
      const bindpose = node.uniqueBindPose ?? node.bindpose?.[this.skinIndex];
      this.bindposes[slot] = bindpose;
      if (node.uniqueBindPose) this.uniqueBindPoses[slot] = node.uniqueBindPose;
    }
  }
}

export class Script extends CCAsset {}
export class JavaScript extends Script {}
export class TypeScript extends Script {}

export class SkeletonData extends CCAsset {
  private _skeletonJson: unknown = null;
  private _atlasText = "";
  textures: Texture2D[] = [];
  private _atlasCache: unknown = null;

  set skeletonJson(value: string | unknown) {
    this.reset();
    this._skeletonJson = typeof value === "string" ? JSON.parse(value) : value;
  }
  get skeletonJson(): unknown { return this._skeletonJson; }
  set atlasText(value: string) { this._atlasText = value; this.reset(); }
  get atlasText(): string { return this._atlasText; }
  getAtlas(parse: (text: string) => unknown): unknown | null {
    if (this._atlasCache) return this._atlasCache;
    if (!this._atlasText) return null;
    this._atlasCache = parse(this._atlasText);
    return this._atlasCache;
  }
  reset(): void { this._atlasCache = null; }
}

export class DragonBonesAsset extends CCAsset {
  dragonBonesJson: string | unknown = "";
  private _dragonBonesJsonData: unknown = null;
  nativeAsset: ArrayBuffer | null = null;

  init(parseData: (rawData: unknown, key: string) => void, atlasUUID: string): string {
    if (!this._dragonBonesJsonData && typeof this.dragonBonesJson === "string") {
      this._dragonBonesJsonData = JSON.parse(this.dragonBonesJson);
    }
    const rawData = this._dragonBonesJsonData ?? this.nativeAsset;
    const key = `${this._uuid}#${atlasUUID}`;
    parseData(rawData, key);
    return key;
  }
}

export class DragonBonesAtlasAsset extends CCAsset {
  private _atlasJson = "";
  private _atlasJsonData: unknown = null;
  private _texture: Texture2D | null = null;
  private _atlasData: unknown = null;

  set atlasJson(value: string) {
    this._atlasJson = value;
    this._atlasJsonData = JSON.parse(value);
    this._atlasData = null;
  }
  get atlasJson(): string { return this._atlasJson; }
  set texture(value: Texture2D | null) { this._texture = value; this._atlasData = null; }
  get texture(): Texture2D | null { return this._texture; }
  init(parseAtlas: (data: unknown, texture: Texture2D | null, uuid: string) => unknown): unknown {
    this._atlasJsonData ??= JSON.parse(this._atlasJson);
    this._atlasData ??= parseAtlas(this._atlasJsonData, this._texture, this._uuid);
    return this._atlasData;
  }
}
