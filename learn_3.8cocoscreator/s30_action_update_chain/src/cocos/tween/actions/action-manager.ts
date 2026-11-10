import { type Action, type ActionTarget } from "./action.ts";

interface RunningAction {
  action: Action;
  target: ActionTarget;
}

export class ActionManager {
  private readonly actions: RunningAction[] = [];

  constructor(private readonly report: (message: string) => void) {}

  addAction(action: Action, target: ActionTarget): void {
    this.report("ActionManager.addAction: " + target.name);
    this.actions.push({ action, target });
    action.startWithTarget(target);
  }

  update(dt: number): void {
    this.report("ActionManager.update");
    for (const running of [...this.actions]) {
      running.action.step(dt);
      if (running.action.isDone()) {
        running.action.stop();
        const index = this.actions.indexOf(running);
        if (index >= 0) this.actions.splice(index, 1);
        this.report("动作完成并从管理器移除");
      }
    }
  }

  get runningActionCount(): number {
    return this.actions.length;
  }
}
