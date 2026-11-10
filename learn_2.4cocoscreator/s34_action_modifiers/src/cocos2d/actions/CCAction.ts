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

export abstract class CCFiniteTimeAction extends CCAction {
  protected constructor(readonly duration: number) {
    super();
  }

  abstract update(progress: number): void;
}
