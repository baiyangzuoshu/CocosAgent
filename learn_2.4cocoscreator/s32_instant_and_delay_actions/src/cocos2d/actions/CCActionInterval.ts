import { CCAction, type CCActionTarget } from "./CCAction.ts";

export abstract class CCActionInterval extends CCAction {
  private readonly duration: number;
  private elapsed = 0;
  private firstTick = true;

  constructor(duration: number) {
    super();
    this.duration = Math.max(duration, 0.000001);
  }

  override startWithTarget(target: CCActionTarget): void {
    super.startWithTarget(target);
    this.elapsed = 0;
    this.firstTick = true;
  }

  step(dt: number): void {
    if (this.firstTick) {
      this.firstTick = false;
      this.elapsed = 0;
    } else {
      this.elapsed += dt;
    }
    const progress = Math.max(0, Math.min(1, this.elapsed / this.duration));
    this.update(progress);
  }

  isDone(): boolean {
    return !this.firstTick && this.elapsed >= this.duration;
  }

  get progress(): number {
    return Math.max(0, Math.min(1, this.elapsed / this.duration));
  }

  protected abstract update(progress: number): void;
}

export class CCDelayTime extends CCActionInterval {
  protected update(_progress: number): void {
    // DelayTime only advances elapsed time.
  }
}
