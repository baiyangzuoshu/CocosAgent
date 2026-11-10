import type { CCActionInterval, CCActionTarget } from "../actions/CCActionInterval.ts";
import type CCDirector from "./CCDirector.ts";

export default class CCNode implements CCActionTarget {
  constructor(
    readonly name: string,
    private readonly director: CCDirector,
    public x: number,
  ) {}

  runAction(action: CCActionInterval): void {
    this.director.getActionManager().addAction(action, this);
  }
}
