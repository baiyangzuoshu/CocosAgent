import { type ActionInterval, type ActionTarget } from "./action-interval.ts";

export class ActionManager {
  private actions: ActionInterval[] = [];

  addAction(action: ActionInterval, target: ActionTarget): void {
    action.startWithTarget(target);
    this.actions.push(action);
  }

  update(dt: number): void {
    for (const action of this.actions) action.step(dt);
    this.actions = this.actions.filter((action) => !action.isDone());
  }

  get runningActionCount(): number {
    return this.actions.length;
  }
}
