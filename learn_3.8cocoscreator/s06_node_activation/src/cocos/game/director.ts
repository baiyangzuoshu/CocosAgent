import EventTarget from "../core/event/event-target.ts";
import { cclegacy } from "../core/global-exports.ts";
import NodeActivator from "../scene-graph/node-activator.ts";
import type { Scene } from "../scene-graph/scene.ts";

export class Director extends EventTarget {
  static readonly EVENT_INIT = "director_init";
  static readonly EVENT_AFTER_UPDATE = "after_update";

  initialized = false;
  totalFrames = 0;
  deltaTime = 0;
  readonly _nodeActivator = new NodeActivator();
  private _scene: Scene | null = null;

  init(): void {
    this.totalFrames = 0;
    this.initialized = true;
    this.emit(Director.EVENT_INIT);
  }

  tick(deltaTime: number): void {
    if (!this.initialized) {
      return;
    }

    this.deltaTime = deltaTime;
    this.totalFrames += 1;
    this.emit(Director.EVENT_AFTER_UPDATE);
  }

  runSceneImmediate(scene: Scene): void {
    this._scene = scene;
    scene._activate();
  }
}

export const director = (cclegacy.director = new Director());
