import { type ActionTarget } from "./actions/action-interval.ts";
import TweenAction from "./tween-action.ts";
import TweenSystem from "./tween-system.ts";

export class Tween<T extends ActionTarget> {
  private action: TweenAction | null = null;

  constructor(private readonly target: T) {}

  to(duration: number, properties: { x: number }): this {
    this.action = new TweenAction(duration, properties.x);
    return this;
  }

  start(): this {
    if (!this.action) throw new Error("Tween.to must be called before start");
    const system = TweenSystem.instance;
    if (!system) throw new Error("TweenSystem must be registered before start");
    system.ActionManager.addAction(this.action, this.target);
    return this;
  }
}

export function tween<T extends ActionTarget>(target: T): Tween<T> {
  return new Tween(target);
}
