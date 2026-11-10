export interface UpdateTarget {
  update(dt: number): void;
}

export default class CCScheduler {
  private readonly targets: UpdateTarget[] = [];

  constructor(private readonly report: (message: string) => void) {}

  scheduleUpdate(target: UpdateTarget): void {
    this.targets.push(target);
  }

  update(dt: number): void {
    this.report("CCScheduler.update");
    for (const target of this.targets) target.update(dt);
  }
}
