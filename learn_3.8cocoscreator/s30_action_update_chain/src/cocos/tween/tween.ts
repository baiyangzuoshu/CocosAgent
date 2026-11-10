import { type Action, type ActionTarget } from "./actions/action.ts";
import TweenSystem from "./tween-system.ts";

export class Tween<T extends ActionTarget> {
  constructor(
    private readonly target: T,
    private readonly action: Action,
  ) {}

  start(): this {
    const system = TweenSystem.instance;
    if (!system) throw new Error("TweenSystem 尚未注册");
    system.ActionManager.addAction(this.action, this.target);
    return this;
  }
}

export function tween<T extends ActionTarget>(
  target: T,
  action: Action,
): Tween<T> {
  return new Tween(target, action);
}
