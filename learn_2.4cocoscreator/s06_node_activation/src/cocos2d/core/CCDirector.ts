import EventTarget from "./event/event-target.ts";
import NodeActivator from "./node-activator.ts";
import game from "./CCGame.ts";
import type Scene from "./CCScene.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Director extends EventTarget {
  static readonly EVENT_AFTER_UPDATE = "director_after_update";

  _initialized = false;
  _totalFrames = 0;
  _lastUpdate = 0;
  _deltaTime = 0;
  readonly _nodeActivator = new NodeActivator();
  private _scene: Scene | null = null;

  constructor() {
    super();
    game.once(game.EVENT_ENGINE_INITED, this.init, this);
  }

  init(): boolean {
    this._totalFrames = 0;
    this._lastUpdate = performance.now();
    this._deltaTime = 0;
    this._initialized = true;
    return true;
  }

  mainLoop(now: number): void {
    if (!this._initialized) {
      return;
    }

    this._deltaTime = now > this._lastUpdate ? (now - this._lastUpdate) / 1000 : 0;
    this._lastUpdate = now;
    this._totalFrames++;
    this.emit(Director.EVENT_AFTER_UPDATE, this._deltaTime);
  }

  runSceneImmediate(scene: Scene): void {
    this._scene = scene;
    scene._activate();
  }

  get totalFrames(): number {
    return this._totalFrames;
  }
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const _global = window as CocosWindow;

if (!_global.cc) {
  throw new Error("cc must be initialized before CCDirector");
}

_global.cc.Director = Director;
_global.cc.director = new Director();
