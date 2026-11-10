import { Action, type ActionTarget } from "./action.ts";

export abstract class ActionInstant extends Action {
  private done = false;

  override startWithTarget(target: ActionTarget): void {
    super.startWithTarget(target);
    this.done = false;
  }

  step(_dt: number): void {
    this.update(1);
  }

  isDone(): boolean {
    return this.done;
  }

  protected update(_time: number): void {
    this.done = true;
  }
}

export class CallFunc extends ActionInstant {
  constructor(private readonly callback: () => void) {
    super();
  }

  protected override update(time: number): void {
    super.update(time);
    this.callback();
  }
}
