import { type CCActionTarget, CCAction } from "./CCAction.ts";

export default class CCActionManager {
  private actions: CCAction[] = [];

  addAction(action: CCAction, target: CCActionTarget): void {
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
