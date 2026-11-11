import type { CCAction, CCActionTarget } from "../actions/CCAction.ts";
import type CCDirector from "./CCDirector.ts";

export default class CCNode implements CCActionTarget {
  constructor(
    readonly name: string,
    private readonly director: CCDirector,
    public x: number,
  ) {}

  runAction(action: CCAction): void {
    this.director.getActionManager().addAction(action, this);
  }
}
