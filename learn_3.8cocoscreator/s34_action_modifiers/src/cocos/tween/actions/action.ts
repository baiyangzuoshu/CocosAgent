export interface ActionTarget {
  readonly name: string;
}

export abstract class Action {
  protected target: ActionTarget | null = null;

  startWithTarget(target: ActionTarget): void {
    this.target = target;
  }

  abstract step(dt: number): void;
  abstract isDone(): boolean;
}

export abstract class FiniteTimeAction extends Action {
  protected constructor(readonly duration: number) {
    super();
  }

  abstract update(progress: number): void;
}
