import EventTarget from "./event/event-target.ts";
import type { CocosNamespace } from "../../index.ts";

export interface GameConfig {
  frameRate?: number;
}

export interface GameObject extends EventTarget {
  EVENT_ENGINE_INITED: string;
  EVENT_GAME_INITED: string;
  config: GameConfig;
  onStart?: () => void;
  _prepared: boolean;
  _rendererInitialized: boolean;
  run(config?: GameConfig, onStart?: () => void): void;
  _initConfig(config: GameConfig): void;
  prepare(callback?: () => void): void;
  _prepareFinished(callback?: () => void): void;
  _initEngine(): void;
}

const game: GameObject = {
  EVENT_ENGINE_INITED: "engine_inited",
  EVENT_GAME_INITED: "game_inited",
  config: { frameRate: 60 },
  _listeners: new Map(),
  _prepared: false,
  _rendererInitialized: false,
  on: EventTarget.prototype.on,
  emit: EventTarget.prototype.emit,

  run(config = {}, onStart) {
    this._initConfig(config);
    this.onStart = onStart;
    this.prepare(this.onStart?.bind(this));
  },

  _initConfig(config) {
    this.config = {
      ...config,
      frameRate: typeof config.frameRate === "number" ? config.frameRate : 60,
    };
  },

  prepare(callback) {
    if (this._prepared) {
      callback?.();
      return;
    }

    // Model the asynchronous preparation boundary without loading engine assets.
    Promise.resolve().then(() => this._prepareFinished(callback));
  },

  _prepareFinished(callback) {
    this._initEngine();
    this._prepared = true;
    this.emit(this.EVENT_GAME_INITED);
    callback?.();
  },

  _initEngine() {
    if (this._rendererInitialized) {
      return;
    }

    this._rendererInitialized = true;
    this.emit(this.EVENT_ENGINE_INITED);
  },
};

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const _global = window as CocosWindow;

if (!_global.cc) {
  throw new Error("cc must be initialized before CCGame");
}

_global.cc.game = game;

export default game;
