import { CCFiniteTimeAction, type CCActionTarget } from "./CCAction.ts";

export abstract class CCActionInterval extends CCFiniteTimeAction {
  private elapsed = 0;
  private firstTick = true;

  constructor(duration: number) {
    super(Math.max(duration, 0.000001));
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

export class CCDelayTime extends CCActionInterval {
  update(_progress: number): void {
    // DelayTime only advances time.
  }
}

export class CCSequence extends CCActionInterval {
  private readonly split: number;
  private last = -1;

  constructor(
    private readonly first: CCFiniteTimeAction,
    private readonly second: CCFiniteTimeAction,
  ) {
    super(first.duration + second.duration);
    this.split = first.duration / this.duration;
  }

  override startWithTarget(target: CCActionTarget): void {
    super.startWithTarget(target);
    this.last = -1;
  }

  override update(progress: number): void {
    let found = 0;
    let localProgress: number;

    if (progress < this.split) {
      localProgress = this.split === 0 ? 1 : progress / this.split;
    } else {
      found = 1;
      localProgress = this.split === 1
        ? 1
        : (progress - this.split) / (1 - this.split);

      if (this.last === -1) {
        this.first.startWithTarget(this.target!);
        this.first.update(1);
      } else if (this.last === 0) {
        this.first.update(1);
      }
    }

    const action = found === 0 ? this.first : this.second;
    if (this.last === found && action.isDone()) return;
    if (this.last !== found) action.startWithTarget(this.target!);
    action.update(Math.max(0, Math.min(1, localProgress)));
    this.last = found;
  }
}

export class CCSpawn extends CCActionInterval {
  private readonly first: CCFiniteTimeAction;
  private readonly second: CCFiniteTimeAction;

  constructor(first: CCFiniteTimeAction, second: CCFiniteTimeAction) {
    const duration = Math.max(first.duration, second.duration);
    super(duration);
    this.first = first.duration < duration
      ? new CCSequence(first, new CCDelayTime(duration - first.duration))
      : first;
    this.second = second.duration < duration
      ? new CCSequence(second, new CCDelayTime(duration - second.duration))
      : second;
  }

  override startWithTarget(target: CCActionTarget): void {
    super.startWithTarget(target);
    this.first.startWithTarget(target);
    this.second.startWithTarget(target);
  }

  override update(progress: number): void {
    this.first.update(progress);
    this.second.update(progress);
  }
}
