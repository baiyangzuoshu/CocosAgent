import { ActionInterval, type ActionTarget } from "./actions/action-interval.ts";

export default class TweenAction extends ActionInterval {
  private startX = 0;

  constructor(duration: number, private readonly endX: number) {
    super(duration);
  }

  override startWithTarget(target: ActionTarget): void {
    super.startWithTarget(target);
    this.startX = target.x;
  }

  protected override update(progress: number): void {
    if (this.target) {
      this.target.x = this.startX + (this.endX - this.startX) * progress;
    }
  }
}
