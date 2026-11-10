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
  _paused: boolean;
  _intervalId?: number;
  run(config?: GameConfig, onStart?: () => void): void;
  _initConfig(config: GameConfig): void;
  prepare(callback?: () => void): void;
  _prepareFinished(callback?: () => void): void;
  _initEngine(): void;
  _runMainLoop(): void;
}

const game: GameObject = {
  EVENT_ENGINE_INITED: "engine_inited",
  EVENT_GAME_INITED: "game_inited",
  config: { frameRate: 60 },
  _listeners: new Map(),
  _prepared: false,
  _rendererInitialized: false,
  _paused: true,
  _intervalId: undefined,
  on: EventTarget.prototype.on,
  once: EventTarget.prototype.once,
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
    this._runMainLoop();
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

  _runMainLoop() {
    if (!this._prepared) {
      return;
    }

    const director = _global.cc?.director;

    if (!director) {
      throw new Error("cc.director must be initialized before the main loop");
    }

    const callback: FrameRequestCallback = (now) => {
      if (this._paused) {
        return;
      }

      this._intervalId = window.requestAnimationFrame(callback);
      director.mainLoop(now);
    };

    this._intervalId = window.requestAnimationFrame(callback);
    this._paused = false;
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
