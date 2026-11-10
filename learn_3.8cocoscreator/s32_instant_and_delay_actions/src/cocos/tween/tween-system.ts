import { ActionManager } from "./actions/action-manager.ts";

export default class TweenSystem {
  static instance: TweenSystem | null = null;
  readonly ActionManager = new ActionManager();

  constructor() {
    TweenSystem.instance = this;
  }

  update(dt: number): void {
    this.ActionManager.update(dt);
  }
}
