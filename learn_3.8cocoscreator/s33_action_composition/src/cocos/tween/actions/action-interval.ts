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

export class DelayTime extends ActionInterval {
  update(_progress: number): void {
    // DelayTime advances time without changing the target.
  }
}

export class Sequence extends ActionInterval {
  private readonly split: number;
  private last = -1;
  private readonly first: FiniteTimeAction;
  private readonly second: FiniteTimeAction;

  constructor(actions: FiniteTimeAction[]) {
    super(Sequence.getDuration(actions));
    if (actions.length !== 2) throw new Error("本课 Sequence 只组合两个动作");
    this.first = actions[0];
    this.second = actions[1];
    this.split = this.first.duration / this.duration;
  }

  private static getDuration(actions: FiniteTimeAction[]): number {
    return actions.reduce((total, action) => total + action.duration, 0);
  }

  override startWithTarget(target: ActionTarget): void {
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

export class Spawn extends ActionInterval {
  private readonly first: FiniteTimeAction;
  private readonly second: FiniteTimeAction;

  constructor(actions: FiniteTimeAction[]) {
    if (actions.length !== 2) throw new Error("本课 Spawn 只并行两个动作");
    const [first, second] = actions;
    const duration = Math.max(first.duration, second.duration);
    super(duration);
    this.first = first.duration < duration
      ? new Sequence([first, new DelayTime(duration - first.duration)])
      : first;
    this.second = second.duration < duration
      ? new Sequence([second, new DelayTime(duration - second.duration)])
      : second;
  }

  override startWithTarget(target: ActionTarget): void {
    super.startWithTarget(target);
    this.first.startWithTarget(target);
    this.second.startWithTarget(target);
  }

  override update(progress: number): void {
    this.first.update(progress);
    this.second.update(progress);
  }
}
