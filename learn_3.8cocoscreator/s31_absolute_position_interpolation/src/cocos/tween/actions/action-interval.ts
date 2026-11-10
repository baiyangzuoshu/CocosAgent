export interface ActionTarget {
  x: number;
}

export abstract class ActionInterval {
  protected target: ActionTarget | null = null;
  private readonly duration: number;
  private elapsed = 0;
  private firstTick = true;

  constructor(duration: number) {
    this.duration = Math.max(duration, 0.000001);
  }

  startWithTarget(target: ActionTarget): void {
    this.target = target;
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

  protected abstract update(progress: number): void;
}
