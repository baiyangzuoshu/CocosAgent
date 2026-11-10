export interface CCActionTarget {
  readonly name: string;
}

export interface CCAction {
  startWithTarget(target: CCActionTarget): void;
  step(dt: number): void;
  isDone(): boolean;
  stop(): void;
}

export class ProbeAction implements CCAction {
  private target: CCActionTarget | null = null;
  private steps = 0;

  constructor(
    private readonly report: (message: string) => void,
    private readonly finishAfter = 3,
  ) {}

  startWithTarget(target: CCActionTarget): void {
    this.target = target;
    this.report("startWithTarget: " + target.name);
  }

  step(dt: number): void {
    this.steps += 1;
    this.report("Action.step #" + this.steps + "，dt=" + dt.toFixed(3));
  }

  isDone(): boolean {
    return this.steps >= this.finishAfter;
  }

  stop(): void {
    this.report("Action.stop: " + (this.target?.name ?? "unknown"));
  }
}
