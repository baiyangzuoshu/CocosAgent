import { FiniteTimeAction, type ActionTarget } from "./action.ts";

export abstract class ActionInterval extends FiniteTimeAction {
  private elapsed = 0;
  private firstTick = true;

  constructor(duration: number) {
    super(Math.max(duration, 0.000001));
  }

  override startWithTarget(target: ActionTarget): void {
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
    this.update(this.progress);
  }

  isDone(): boolean {
    return !this.firstTick && this.elapsed >= this.duration;
  }

  get progress(): number {
    return Math.max(0, Math.min(1, this.elapsed / this.duration));
  }

  abstract override update(progress: number): void;
}

export class Repeat extends ActionInterval {
  private iteration = 0;

  constructor(
    private readonly innerAction: ActionInterval,
    private readonly times: number,
  ) {
    super(innerAction.duration * Math.max(1, times));
  }

  override startWithTarget(target: ActionTarget): void {
    super.startWithTarget(target);
    this.iteration = 0;
    this.innerAction.startWithTarget(target);
  }

  override update(progress: number): void {
    const repeatCount = Math.max(1, this.times);
    const scaled = Math.max(0, Math.min(1, progress)) * repeatCount;
    const current = Math.min(repeatCount - 1, Math.floor(scaled));
    const localProgress = progress >= 1 ? 1 : scaled - current;

    while (this.iteration < current) {
      this.innerAction.update(1);
      this.iteration++;
      if (this.iteration < repeatCount) {
        this.innerAction.startWithTarget(this.target!);
      }
    }
    this.innerAction.update(localProgress);
  }

  get currentIteration(): number {
    return this.iteration + 1;
  }
}

export class ReverseTime extends ActionInterval {
  constructor(private readonly innerAction: ActionInterval) {
    super(innerAction.duration);
  }

  override startWithTarget(target: ActionTarget): void {
    super.startWithTarget(target);
    this.innerAction.startWithTarget(target);
  }

  override update(progress: number): void {
    this.innerAction.update(1 - progress);
  }
}
