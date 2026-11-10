import { CCMoveTo } from "./CCActionInterval.ts";
import type CCNode from "../core/CCNode.ts";

export class Tween {
  private action: CCMoveTo | null = null;

  constructor(private readonly target: CCNode) {}

  to(duration: number, properties: { x: number }): this {
    this.action = new CCMoveTo(duration, properties.x);
    return this;
  }

  start(): this {
    if (!this.action) throw new Error("Tween.to must be called before start");
    this.target.runAction(this.action);
    return this;
  }
}

export function tween(target: CCNode): Tween {
  return new Tween(target);
}
