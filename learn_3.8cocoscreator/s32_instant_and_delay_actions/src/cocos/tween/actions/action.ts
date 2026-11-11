export interface ActionTarget {
  x: number;
}

export abstract class Action {
  protected target: ActionTarget | null = null;

  startWithTarget(target: ActionTarget): void {
    this.target = target;
  }

  abstract step(dt: number): void;
  abstract isDone(): boolean;
}
