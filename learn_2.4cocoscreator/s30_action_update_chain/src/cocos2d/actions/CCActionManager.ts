import type { CCAction, CCActionTarget } from "./CCAction.ts";

interface RunningAction {
  action: CCAction;
  target: CCActionTarget;
}

export default class CCActionManager {
  private readonly actions: RunningAction[] = [];

  constructor(private readonly report: (message: string) => void) {}

  addAction(action: CCAction, target: CCActionTarget): void {
    this.report("CCActionManager.addAction: " + target.name);
    this.actions.push({ action, target });
    action.startWithTarget(target);
  }

  update(dt: number): void {
    this.report("CCActionManager.update");
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
