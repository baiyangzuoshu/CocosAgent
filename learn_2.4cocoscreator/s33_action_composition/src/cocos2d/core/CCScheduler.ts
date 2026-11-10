export interface UpdateTarget {
  update(dt: number): void;
}

export default class CCScheduler {
  private readonly targets: UpdateTarget[] = [];

  scheduleUpdate(target: UpdateTarget): void {
    this.targets.push(target);
  }

  update(dt: number): void {
    for (const target of this.targets) target.update(dt);
  }
}
