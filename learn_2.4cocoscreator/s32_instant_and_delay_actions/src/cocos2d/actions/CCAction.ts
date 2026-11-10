export interface CCActionTarget {
  readonly name: string;
}

export abstract class CCAction {
  protected target: CCActionTarget | null = null;

  startWithTarget(target: CCActionTarget): void {
    this.target = target;
  }

  abstract step(dt: number): void;
  abstract isDone(): boolean;
}
