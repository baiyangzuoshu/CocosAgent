import { CCAction } from "./CCAction.ts";

export abstract class CCActionInstant extends CCAction {
  step(_dt: number): void {
    this.update(1);
  }

  isDone(): boolean {
    return true;
  }

  protected update(_time: number): void {}
}

export class CCCallFunc extends CCActionInstant {
  constructor(private readonly callback: () => void) {
    super();
  }

  protected override update(_time: number): void {
    this.callback();
  }
}
