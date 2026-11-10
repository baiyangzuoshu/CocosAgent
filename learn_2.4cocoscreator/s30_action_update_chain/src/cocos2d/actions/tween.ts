import type { CCAction, CCActionTarget } from "./CCAction.ts";
import type CCDirector from "../core/CCDirector.ts";

export default class Tween<T extends CCActionTarget> {
  constructor(
    private readonly target: T,
    private readonly director: CCDirector,
    private readonly action: CCAction,
  ) {}

  start(): this {
    this.director.getActionManager().addAction(this.action, this.target);
    return this;
  }
}

export function tween<T extends CCActionTarget>(
  target: T,
  director: CCDirector,
  action: CCAction,
): Tween<T> {
  return new Tween(target, director, action);
}
