import EventTarget from "../core/event/event-target.ts";
import { cclegacy } from "../core/global-exports.ts";
import { director } from "./director.ts";
import Pacer from "../../pal/pacer/pacer-web.ts";

export class Game extends EventTarget {
  static readonly EVENT_PRE_BASE_INIT = "pre_base_init";
  static readonly EVENT_POST_BASE_INIT = "post_base_init";
  static readonly EVENT_PRE_INFRASTRUCTURE_INIT = "pre_infrastructure_init";
  static readonly EVENT_POST_INFRASTRUCTURE_INIT = "post_infrastructure_init";
  static readonly EVENT_PRE_SUBSYSTEM_INIT = "pre_subsystem_init";
  static readonly EVENT_POST_SUBSYSTEM_INIT = "post_subsystem_init";
  static readonly EVENT_ENGINE_INITED = "engine_inited";
  static readonly EVENT_PRE_PROJECT_INIT = "pre_project_init";
  static readonly EVENT_POST_PROJECT_INIT = "post_project_init";
  static readonly EVENT_GAME_INITED = "game_inited";

  private _inited = false;
  private _startTime = performance.now();
  private _pacer = new Pacer();

  constructor() {
    super();
    this._pacer.onTick = this._updateCallback.bind(this);
  }

  init(_config: object): Promise<void> {
    return Promise.resolve()
      .then(() => this.emit(Game.EVENT_PRE_BASE_INIT))
      .then(() => this.emit(Game.EVENT_POST_BASE_INIT))
      .then(() => this.emit(Game.EVENT_PRE_INFRASTRUCTURE_INIT))
      .then(() => {
        this._initPacer();
        this.emit(Game.EVENT_POST_INFRASTRUCTURE_INIT);
      })
      .then(() => this.emit(Game.EVENT_PRE_SUBSYSTEM_INIT))
      .then(() => {
        director.init();
        this.emit(Game.EVENT_POST_SUBSYSTEM_INIT);
        this.emit(Game.EVENT_ENGINE_INITED);
      })
      .then(() => this.emit(Game.EVENT_PRE_PROJECT_INIT))
      .then(() => this.emit(Game.EVENT_POST_PROJECT_INIT))
      .then(() => {
        this._inited = true;
        this.emit(Game.EVENT_GAME_INITED);
      });
  }

  run(): void {
    if (!this._inited) {
      return;
    }
    this._pacer.start();
  }

  private _initPacer(): void {
    this._pacer = new Pacer();
    this._pacer.onTick = this._updateCallback.bind(this);
  }

  private _updateCallback(): void {
    if (this._inited) {
      director.tick(this._calculateDT());
    }
  }

  private _calculateDT(): number {
    const now = performance.now();
    const deltaTime = Math.max(0, (now - this._startTime) / 1000);
    this._startTime = now;
    return deltaTime;
  }
}

export const game = (cclegacy.game = new Game());
