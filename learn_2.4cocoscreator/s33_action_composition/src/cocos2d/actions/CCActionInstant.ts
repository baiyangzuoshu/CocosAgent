import { CCFiniteTimeAction } from "./CCAction.ts";

export abstract class CCActionInstant extends CCFiniteTimeAction {
  private done = false;

  protected constructor() {
    super(0);
  }

  override startWithTarget(target: import("./CCAction.ts").CCActionTarget): void {
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

export class CCCallFunc extends CCActionInstant {
  constructor(private readonly callback: () => void) {
    super();
  }

  override update(progress: number): void {
    super.update(progress);
    this.callback();
  }
}
