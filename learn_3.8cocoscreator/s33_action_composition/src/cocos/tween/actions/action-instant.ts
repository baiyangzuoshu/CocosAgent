import { FiniteTimeAction, type ActionTarget } from "./action.ts";

export class ActionInstant extends FiniteTimeAction {
  private done = false;

  constructor() {
    super(0);
  }

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

  update(_progress: number): void {
    this.done = true;
  }
}

export class CallFunc extends ActionInstant {
  constructor(private readonly callback: () => void) {
    super();
  }

  override update(progress: number): void {
    super.update(progress);
    this.callback();
  }
}
