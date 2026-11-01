import EventTarget from "../core/event/event-target.ts";
import { cclegacy } from "../core/global-exports.ts";
import { director } from "./director.ts";

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

  init(_config: object): Promise<void> {
    return Promise.resolve()
      .then(() => this.emit(Game.EVENT_PRE_BASE_INIT))
      .then(() => this.emit(Game.EVENT_POST_BASE_INIT))
      .then(() => this.emit(Game.EVENT_PRE_INFRASTRUCTURE_INIT))
      .then(() => this.emit(Game.EVENT_POST_INFRASTRUCTURE_INIT))
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

  run(onStart?: () => void): void {
    if (!this._inited) {
      return;
    }
    onStart?.();
  }
}

export const game = (cclegacy.game = new Game());
