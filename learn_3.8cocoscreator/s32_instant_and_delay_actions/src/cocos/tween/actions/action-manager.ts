import { type Action, type ActionTarget } from "./action.ts";

export class ActionManager {
  private actions: Action[] = [];

  addAction(action: Action, target: ActionTarget): void {
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
