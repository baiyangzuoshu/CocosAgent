import { ActionManager } from "./actions/action-manager.ts";

export default class TweenSystem {
  static instance: TweenSystem | null = null;
  readonly ActionManager: ActionManager;

  constructor(private readonly report: (message: string) => void) {
    this.ActionManager = new ActionManager(report);
    TweenSystem.instance = this;
  }

  update(dt: number): void {
    this.report("TweenSystem.update");
    this.ActionManager.update(dt);
  }
}
