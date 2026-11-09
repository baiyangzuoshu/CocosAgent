import EventTarget from "../core/event/event-target.ts";
import { cclegacy } from "../core/global-exports.ts";
import NodeActivator from "../scene-graph/node-activator.ts";
import { ComponentScheduler } from "../scene-graph/component-scheduler.ts";
import type { Scene } from "../scene-graph/scene.ts";
import { Root } from "../root.ts";
import CCObject from "../core/data/object.ts";

export class Director extends EventTarget {
  static readonly EVENT_INIT = "director_init";
  static readonly EVENT_AFTER_UPDATE = "after_update";
  static readonly EVENT_AFTER_RENDER = "after_render";

  initialized = false;
  totalFrames = 0;
  deltaTime = 0;
  readonly _nodeActivator = new NodeActivator();
  readonly _compScheduler = new ComponentScheduler();
  private _scene: Scene | null = null;
  private _root: Root | null = null;

  init(): void {
    this.totalFrames = 0;
    this._root = new Root();
    this.initialized = true;
    this.emit(Director.EVENT_INIT);
  }

  tick(deltaTime: number): void {
    if (!this.initialized) {
      return;
    }

    this.deltaTime = deltaTime;
    this.totalFrames += 1;
    this._compScheduler.startPhase();
    this._compScheduler.updatePhase(deltaTime);
    this._compScheduler.lateUpdatePhase(deltaTime);
    this.emit(Director.EVENT_AFTER_UPDATE);
    CCObject._deferredDestroy();
    this._root?.frameMove(deltaTime);
    this.emit(Director.EVENT_AFTER_RENDER);
  }

  runSceneImmediate(scene: Scene): void {
    this._scene = scene;
    scene._activate();
    this._root?.setScene(scene);
  }

  get lastRenderedSceneName(): string {
    return this._root?.lastRenderedSceneName ?? "等待 Root 初始化";
  }

  get drawCallCount(): number {
    return this._root?.drawCallCount ?? 0;
  }
}

export const director = (cclegacy.director = new Director());
