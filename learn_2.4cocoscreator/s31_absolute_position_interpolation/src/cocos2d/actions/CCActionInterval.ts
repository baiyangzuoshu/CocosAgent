export interface CCActionTarget {
  x: number;
}

export abstract class CCActionInterval {
  protected target: CCActionTarget | null = null;
  private readonly duration: number;
  private elapsed = 0;
  private firstTick = true;

  constructor(duration: number) {
    this.duration = Math.max(duration, 0.000001);
  }

  startWithTarget(target: CCActionTarget): void {
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

export class CCMoveBy extends CCActionInterval {
  protected startX = 0;
  protected deltaX: number;

  constructor(duration: number, deltaX: number) {
    super(duration);
    this.deltaX = deltaX;
  }

  override startWithTarget(target: CCActionTarget): void {
    super.startWithTarget(target);
    this.startX = target.x;
  }

  protected update(progress: number): void {
    if (this.target) this.target.x = this.startX + this.deltaX * progress;
  }
}

export class CCMoveTo extends CCMoveBy {
  constructor(duration: number, private readonly endX: number) {
    super(duration, 0);
  }

  override startWithTarget(target: CCActionTarget): void {
    super.startWithTarget(target);
    this.deltaX = this.endX - target.x;
  }
}
