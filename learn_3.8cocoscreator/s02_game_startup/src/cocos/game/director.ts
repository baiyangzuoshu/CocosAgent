import EventTarget from "../core/event/event-target.ts";
import { cclegacy } from "../core/global-exports.ts";

export class Director extends EventTarget {
  initialized = false;

  init(): void {
    this.initialized = true;
    this.emit(Director.EVENT_INIT);
  }

  static readonly EVENT_INIT = "director_init";
}

export const director = (cclegacy.director = new Director());
